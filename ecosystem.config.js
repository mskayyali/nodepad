module.exports = {
     apps: [{
       name: "nodepad",
       script: "node_modules/next/dist/bin/next",
       args: "start",
       instances: "max", // Utilizes all available CPU cores (cluster mode)
       exec_mode: "cluster", 
       env: {
         NODE_ENV: "production",
         PORT: 3000
       }
     }]
   };