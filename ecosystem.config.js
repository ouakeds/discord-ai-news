module.exports = {
  apps: [{
    name: 'discord-ai-news',
    script: 'dist/index.js',
    restart_delay: 5000,
    max_restarts: 10,
    out_file: 'logs/out.log',
    error_file: 'logs/error.log',
    watch: false,
  }],
};
