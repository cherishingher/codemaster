"""
Judge Dispatch — 桥接 CodeMaster Redis Stream 与本地 285K Judge Worker

替换原 services/judge-agent，对 Next.js 应用零侵入：
  Redis (judge:jobs) → 本服务 → WebSocket → 本地 judge-worker → 回调 /api/judge/callback

部署位置：云服务器（与 Next.js、Redis 同机）
"""

import asyncio
import json
import os
import uuid
from datetime import datetime

import httpx
import redis.asyncio as aioredis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from contextlib import asynccontextmanager

# ─── 配置 ───

REDIS_URL = os.environ.get("REDIS_URL", "redis://127.0.0.1:6379")
API_BASE_URL = os.environ.get("API_BASE_URL", "http://127.0.0.1:3000")
JUDGE_CALLBACK_SECRET = os.environ.get("JUDGE_CALLBACK_SECRET", "dev-judge-secret")
JUDGE_ID = os.environ.get("JUDGE_ID", "judge-dispatch")

STREAM_KEY = "judge:jobs"
GROUP = "judge-agents"
# 固定 consumer 名，确保重启后能恢复上次未 ack 的 pending 消息
CONSUMER_NAME = JUDGE_ID

LANG_MAP = {
    "cpp11": ("cpp", "c++11"),
    "cpp14": ("cpp", "c++14"),
    "cpp17": ("cpp", "c++17"),
    "python": ("python", None),
    "c": ("c", None),
}

STATUS_MAP = {
    "AC":  "ACCEPTED",
    "WA":  "WRONG_ANSWER",
    "TLE": "TIME_LIMIT_EXCEEDED",
    "RE":  "RUNTIME_ERROR",
    "CE":  "COMPILE_ERROR",
}

# ─── 全局状态 ───

rdb: aioredis.Redis = None
task_queue: asyncio.Queue = None
judge_workers: dict = {}
pending_results: dict = {}
stats = {"total_dispatched": 0, "total_completed": 0, "started_at": None}


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rdb, task_queue
    rdb = aioredis.from_url(REDIS_URL, decode_responses=True)
    task_queue = asyncio.Queue()
    stats["started_at"] = datetime.now().isoformat()

    await _ensure_consumer_group()
    consumer_task = asyncio.create_task(_redis_consumer_loop())

    print(f"[+] Judge Dispatch started")
    print(f"    Redis:    {REDIS_URL}")
    print(f"    Callback: {API_BASE_URL}/api/judge/callback")
    print(f"    Consumer: {CONSUMER_NAME} in group {GROUP}")
    yield

    consumer_task.cancel()
    await rdb.aclose()


app = FastAPI(title="Judge Dispatch", lifespan=lifespan)


# ─── Redis Consumer ───


async def _ensure_consumer_group():
    """与 judge-agent 一致，用 $ 表示只消费新消息"""
    try:
        await rdb.xgroup_create(STREAM_KEY, GROUP, "$", mkstream=True)
    except Exception as e:
        if "BUSYGROUP" not in str(e):
            raise


async def _redis_consumer_loop():
    """持续读取 Redis Stream 中的判题任务"""
    print(f"[i] Redis consumer: {CONSUMER_NAME}")

    # 用 XAUTOCLAIM 领回所有 consumer group 中超过 60 秒未 ack 的孤儿消息
    # 不限于本 consumer，任何崩溃的 consumer 遗留的消息都能被回收
    try:
        recovered = 0
        cursor = "0-0"
        while True:
            result = await rdb.xautoclaim(
                STREAM_KEY, GROUP, CONSUMER_NAME,
                min_idle_time=60000,  # 60 秒未 ack 视为孤儿
                start_id=cursor, count=50,
            )
            next_cursor, messages, _ = result
            for msg_id, fields in messages:
                if not fields:
                    await rdb.xack(STREAM_KEY, GROUP, msg_id)
                    continue
                payload_raw = fields.get("payload", "{}")
                asyncio.create_task(_safe_handle_job(payload_raw, msg_id))
                recovered += 1
            if next_cursor == "0-0" or not messages:
                break
            cursor = next_cursor
        if recovered:
            print(f"[i] Recovered {recovered} orphaned messages via XAUTOCLAIM")
    except Exception as e:
        print(f"[!] Orphan recovery error: {e}")

    while True:
        try:
            results = await rdb.xreadgroup(
                GROUP, CONSUMER_NAME,
                {STREAM_KEY: ">"},
                count=10, block=2000,
            )

            if not results:
                continue

            for stream_name, messages in results:
                for msg_id, fields in messages:
                    payload_raw = fields.get("payload", "{}")
                    asyncio.create_task(
                        _safe_handle_job(payload_raw, msg_id)
                    )

        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[!] Redis consumer error: {e}, retrying in 3s...")
            await asyncio.sleep(3)


async def _safe_handle_job(payload_raw: str, msg_id: str):
    try:
        payload = json.loads(payload_raw)
        await _handle_redis_job(payload, msg_id)
    except Exception as e:
        print(f"[!] Job error: {e}")
        sub_id = None
        try:
            p = json.loads(payload_raw)
            sub_id = p.get("submissionId")
        except Exception:
            pass
        if sub_id:
            await _report_callback(sub_id, "SYSTEM_ERROR", 0, [])
    finally:
        try:
            await rdb.xack(STREAM_KEY, GROUP, msg_id)
        except Exception:
            pass


async def _read_file_uri(uri: str) -> str:
    if uri.startswith("file://"):
        path = uri[7:]
    else:
        path = uri
    with open(path, "r") as f:
        return f.read()


async def _handle_redis_job(payload: dict, msg_id: str):
    submission_id = payload["submissionId"]
    language_key = payload.get("language", "cpp17")
    lang, cpp_std = LANG_MAP.get(language_key, ("cpp", "c++17"))

    code = payload.get("code", "")
    if not code and payload.get("codeUri"):
        code = await _read_file_uri(payload["codeUri"])

    testcases_meta = payload.get("testcases", [])
    test_cases_for_worker = []
    for tc in testcases_meta:
        inp = await _read_file_uri(tc["inputUri"])
        expected = await _read_file_uri(tc["outputUri"])
        test_cases_for_worker.append({
            "input": inp,
            "expected_output": expected,
        })

    task_id = payload.get("jobId", submission_id)

    task = {
        "task_id": task_id,
        "language": lang,
        "source_code": code,
        "test_cases": test_cases_for_worker,
        "time_limit": payload.get("timeLimitMs", 1000),
        "memory_limit": payload.get("memoryLimitMb", 256),
    }

    if cpp_std:
        task["cpp_std"] = cpp_std

    future = asyncio.get_event_loop().create_future()
    pending_results[task_id] = {
        "future": future,
        "submission_id": submission_id,
        "testcases_meta": testcases_meta,
    }

    await task_queue.put(task)
    stats["total_dispatched"] += 1
    print(f"[>] Dispatched {task_id} ({language_key}, {len(testcases_meta)} cases)")

    try:
        result = await asyncio.wait_for(future, timeout=300)
        await _process_result(task_id, result)
    except asyncio.TimeoutError:
        print(f"[!] Task {task_id} timed out")
        await _report_callback(submission_id, "SYSTEM_ERROR", 0, [])
    finally:
        pending_results.pop(task_id, None)


async def _process_result(task_id: str, result: dict):
    meta = pending_results.get(task_id)
    if not meta:
        return

    submission_id = meta["submission_id"]
    testcases_meta = meta["testcases_meta"]

    verdict = result.get("verdict", "SYSTEM_ERROR")
    codemaster_status = STATUS_MAP.get(verdict, "SYSTEM_ERROR")

    if verdict == "CE":
        await _report_callback(submission_id, "COMPILE_ERROR", 0, [])
        stats["total_completed"] += 1
        print(f"[<] {task_id}: CE → callback sent")
        return

    test_results = result.get("test_results", [])

    cases = []
    total_score = 0
    for i, tr in enumerate(test_results):
        tc_meta = testcases_meta[i] if i < len(testcases_meta) else {}
        case_verdict = tr.get("verdict", "SYSTEM_ERROR")
        case_status = STATUS_MAP.get(case_verdict, "SYSTEM_ERROR")
        case_score = tc_meta.get("score", 0) if case_verdict == "AC" else 0
        total_score += case_score

        cases.append({
            "testcaseId": tc_meta.get("testcaseId"),
            "status": case_status,
            "timeMs": tr.get("time_ms", 0),
            "memoryMb": 0,
            "score": case_score,
        })

    await _report_callback(submission_id, codemaster_status, total_score, cases)
    stats["total_completed"] += 1
    print(f"[<] {task_id}: {verdict} (score={total_score}) → callback sent")


async def _report_callback(submission_id: str, status: str, score: int, cases: list):
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{API_BASE_URL}/api/judge/callback",
                json={
                    "submissionId": submission_id,
                    "status": status,
                    "score": score,
                    "cases": cases,
                },
                headers={
                    "Content-Type": "application/json",
                    "x-judge-secret": JUDGE_CALLBACK_SECRET,
                },
                timeout=10,
            )
            if resp.status_code != 200:
                print(f"[!] Callback failed: {resp.status_code} {resp.text}")
    except Exception as e:
        print(f"[!] Callback error: {e}")


# ─── WebSocket: Judge Worker 连接 ───


@app.websocket("/ws/judge")
async def judge_endpoint(websocket: WebSocket):
    await websocket.accept()
    wid = uuid.uuid4().hex[:8]

    worker_info = {
        "ws": websocket,
        "max_concurrent": 1,
        "active_tasks": {},
        "slots": None,
    }
    judge_workers[wid] = worker_info
    print(f"[+] Judge worker {wid} connected (total: {len(judge_workers)})")

    background_tasks: list[asyncio.Task] = []
    try:
        reg_msg = await asyncio.wait_for(websocket.receive_json(), timeout=10)
        if reg_msg.get("type") == "register":
            max_c = min(reg_msg.get("max_concurrent", 1), 128)
            worker_info["max_concurrent"] = max_c
            print(f"[i] Worker {wid}: max_concurrent={max_c}")

        worker_info["slots"] = asyncio.Semaphore(worker_info["max_concurrent"])
        await websocket.send_json({"type": "registered", "max_concurrent": worker_info["max_concurrent"]})

        send_queue: asyncio.Queue = asyncio.Queue()

        async def fetch_tasks():
            while True:
                await worker_info["slots"].acquire()
                task = await task_queue.get()
                worker_info["active_tasks"][task["task_id"]] = task
                await send_queue.put({"type": "task", **task})

        async def send_loop():
            while True:
                msg = await send_queue.get()
                await websocket.send_json(msg)

        async def receive_results():
            while True:
                data = await websocket.receive_json()
                if data.get("type") != "result":
                    continue
                task_id = data.get("task_id")
                if task_id and task_id in pending_results:
                    fut = pending_results[task_id]["future"]
                    if not fut.done():
                        fut.set_result(data)
                worker_info["active_tasks"].pop(task_id, None)
                worker_info["slots"].release()

        t_fetch = asyncio.create_task(fetch_tasks())
        t_send = asyncio.create_task(send_loop())
        t_recv = asyncio.create_task(receive_results())
        background_tasks = [t_fetch, t_send, t_recv]

        # 任意一个协程异常退出则全部停止
        done, _ = await asyncio.wait(
            background_tasks, return_when=asyncio.FIRST_EXCEPTION,
        )
        for t in done:
            if t.exception():
                raise t.exception()

    except WebSocketDisconnect:
        print(f"[-] Judge worker {wid} disconnected")
    except Exception as e:
        print(f"[!] Judge worker {wid} error: {e}")
    finally:
        # 确保所有后台协程被取消，防止继续从 task_queue 取任务
        for t in background_tasks:
            t.cancel()
        await asyncio.gather(*background_tasks, return_exceptions=True)

        for tid, task in worker_info["active_tasks"].items():
            await task_queue.put(task)
            print(f"[↻] Task {tid} re-queued")
        judge_workers.pop(wid, None)


# ─── HTTP API（状态监控）───


@app.get("/api/status")
async def dispatch_status():
    workers = []
    for wid, info in judge_workers.items():
        workers.append({
            "id": wid,
            "max_concurrent": info["max_concurrent"],
            "active_tasks": len(info["active_tasks"]),
        })
    return {
        "judges_online": len(judge_workers),
        "judge_workers": workers,
        "queue_size": task_queue.qsize() if task_queue else 0,
        "pending_results": len(pending_results),
        **stats,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("DISPATCH_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
