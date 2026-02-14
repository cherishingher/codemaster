module.exports = {
  apps: [
    {
      name: "codemaster",
      cwd: "/root/codemaster",
      script: "npm",
      args: "run dev",
      env: {
        HOST: "127.0.0.1",
        NODE_OPTIONS: "--max-old-space-size=1024"
      },
      autorestart: true,
      max_memory_restart: "900M",
      exp_backoff_restart_delay: 100,
      time: true
    }
  ]
}
