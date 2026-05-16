module.exports = {
     apps: [{
       name: "nodepad",
       script: "npm",
       args: "run start",
       instances: "max", // Utilizes all available CPU cores (cluster mode)
       exec_mode: "cluster", 
       env: {
         NODE_ENV: "production",
         PORT: 3000
       }
     }]
   };