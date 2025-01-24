module.exports = {
  apps : [{
    script: './src/index.js',
    name: 's7-knx',
    watch : false,
    ignore_watch: ["node_modules", "public/", "**/*.json", "docs/"],
  }]
};
