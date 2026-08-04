module.exports = {
  apps: [
    {
      name: 'kasir-backend',
      script: 'server/index.js',
      cwd: '/var/www/kasir-db',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: '~/.pm2/logs/kasir-backend-error.log',
      out_file: '~/.pm2/logs/kasir-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
