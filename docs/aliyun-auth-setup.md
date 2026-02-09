# 阿里云验证码（短信/邮件）配置指南

本项目注册流程已支持“邮箱或手机号 + 验证码”。以下是接入阿里云的完整准备步骤与配置清单。

---

## 1. 准备阿里云账号与权限

你需要：
- 一个阿里云账号
- `AccessKeyId` / `AccessKeySecret`（建议使用 RAM 子账号，权限最小化）

建议权限：
- 短信：`AliyunDysmsapiFullAccess`
- 邮件：`AliyunDirectMailFullAccess`

---

## 2. 短信服务（大陆手机号）

### 必须完成
1. 开通 **短信服务**
2. 申请 **短信签名**
3. 申请 **短信模板**

### 模板示例
```
您的验证码为${code}，10分钟内有效。
```

### 需要记录的参数
- 短信签名（例如：CodeMaster）
- 模板 Code（例如：SMS_123456789）

---

## 3. 邮件服务（DirectMail）

### 必须完成
1. 开通 **DirectMail（邮件推送）**
2. 完成发信域名验证
3. 创建发信地址（AccountName）

### 需要记录的参数
- 发信地址（例如：noreply@yourdomain.com）
- 发信别名（可选）
- 标签（可选）

---

## 4. 环境变量配置

把下面内容写进 `apps/web/.env.local` 或 `.env`：

```
AUTH_CODE_SECRET=change-me
DEBUG_AUTH_CODES=false

ALIYUN_ACCESS_KEY_ID=你的KeyId
ALIYUN_ACCESS_KEY_SECRET=你的KeySecret
ALIYUN_REGION_ID=cn-hangzhou

# 短信
ALIYUN_SMS_SIGN_NAME=你的短信签名
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxx

# 邮件
ALIYUN_DM_ACCOUNT_NAME=your_sender@yourdomain.com
ALIYUN_DM_FROM_ALIAS=可选昵称
ALIYUN_DM_SUBJECT=验证码
ALIYUN_DM_TAG_NAME=可选标签
```

说明：
- 短信接口使用 `SendMessageWithTemplate`，`To` 是手机号（建议带国家码，如 `86`）。
- 邮件接口使用 `SingleSendMail`，`HtmlBody` 内置验证码内容。
- 生产环境请把 `DEBUG_AUTH_CODES=false`。

---

## 5. 安装依赖并重启

项目根目录执行：
```
npm install @alicloud/pop-core --workspace apps/web
```

然后重启 `npm run dev` 或生产进程。

---

## 最短执行清单（复制即可）

```
npm install @alicloud/pop-core --workspace apps/web

# apps/web/.env.local 或 .env
AUTH_CODE_SECRET=change-me
DEBUG_AUTH_CODES=false

ALIYUN_ACCESS_KEY_ID=你的KeyId
ALIYUN_ACCESS_KEY_SECRET=你的KeySecret
ALIYUN_REGION_ID=cn-hangzhou

ALIYUN_SMS_SIGN_NAME=你的短信签名
ALIYUN_SMS_TEMPLATE_CODE=SMS_xxx

ALIYUN_DM_ACCOUNT_NAME=your_sender@yourdomain.com
ALIYUN_DM_FROM_ALIAS=可选昵称
ALIYUN_DM_SUBJECT=验证码
ALIYUN_DM_TAG_NAME=可选标签

npm run dev
```

---

## 6. 验证方式

开发环境可以调用：
```
POST /api/auth/request-code
{
  "identifier": "手机号或邮箱",
  "purpose": "register"
}
```

如果 `DEBUG_AUTH_CODES=true`，返回会带 `debugCode` 用于调试。  
生产环境不会返回验证码。
