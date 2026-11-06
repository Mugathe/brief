// pm2 keeps Brief running, restarts it if it stops, and starts it again after a reboot.
//   pm2 start deploy/ecosystem.config.cjs && pm2 save && pm2 startup
module.exports = {
  apps: [
    {
      name: "brief",
      script: "scripts/start.mjs",
      cwd: __dirname + "/..",
      // Exactly one copy: npm start also runs the news refresh schedule, and the news and rate-limit caches live in memory.
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "700M",
      kill_timeout: 10000,
      env: { NODE_ENV: "production" }, // everything else comes from the .env file next to package.json
    },
  ],
};
