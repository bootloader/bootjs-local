
const config = require('@bootloader/config');
const ngrok = require("@ngrok/ngrok");
const port = process.env.PORT || config.get("server.port");
const nodemon = require("nodemon");

const NGROK_URL = config.getIfPresent("NGROK_URL");
const NGROK_TOKEN = config.get("ngrok.auth.token");
//console.log("ngrok.auth.token",NGROK_TOKEN);
console.log("NGROK_URL",NGROK_URL);
console.log("*************************");

function ngrokProperties({token,domain}){
return `
####### NGROK ##############                                 
ngrok.domain=${token}
ngrok.auth.token=${domain}
`
}

let flags = {
    setup : null,
}

let ngrokspace = {
    async start_ngrok({token,domain}) {
        await ngrok.authtoken(token)
        // await ngrok.connect({
        //   authtoken : config.get("ngrok.auth.token"),
        //   //domain : config.get("ngrok.domain")
        // });
        const session = await new ngrok.NgrokSessionBuilder()
        .authtoken(token)
        //.authtokenFromEnv()
        .connect();
        const ssssn =  session.httpEndpoint();
        if(domain){
            ssssn.domain(domain)
        }
        const tunnel = await ssssn.listen();
        //.allowCidr("0.0.0.0/0")
        //const socket = await ngrok.listen(app, tunnel);
        console.log(`Ingress established at: ${tunnel.url()}`);
        //console.log(`Express listening on: ${socket.address()}`);
        tunnel.forward("localhost:"+port);
        config.store("ngrok").url = NGROK_URL;
        return {tunnel};
    },    
    async setup() {
        console.log("NGROK SETUP", NGROK_URL)
        if(!flags.setup){
            if(NGROK_URL){
                flags.setup = new Promise(async function(resolve, reject){
                    config.store("ngrok").url = NGROK_URL;
                    resolve({
                        url : NGROK_URL
                    })
                });
            } else {
                let THAT = this;
                flags.setup = new Promise(async (resolve, reject)=>{
                    try {
                        if(NGROK_TOKEN){
                            let { tunnel } = await THAT.start_ngrok({
                                domain : config.getIfPresent("ngrok.domain"),
                                token : config.get("ngrok.auth.token")
                            });
                            resolve({
                                url : tunnel.url()
                            });
                        } else {
                            let values = await config.manifest({
                                group : "NGROK",
                                props : ['ngrok.domain','ngrok.auth.token']
                            });
                            let {tunnel} = THAT.start_ngrok({
                                token : values['ngrok.auth.token'],
                                domain : values['ngrok.domain']
                            }).then(()=>{
                                resolve({
                                    url : tunnel.url()
                                });
                            });
                        }
                    } catch(e){
                        console.log("Failed====",e)
                        reject(e);
                    }
                });
            }
        }
        return flags.setup;
      },
      async start(options){
      	let { script } = options;
      }
  }

  module.exports = {
        async setup(){
            return await ngrokspace.setup();
        },
        async start(options){
        	let { script, debug } = options;
        	let {url} = await ngrokspace.setup(options);
        	return new Promise(function(resolve,reject){
				   	nodemon({
				      script: script,
				      exec: `cross-env NGROK_URL=${url} node `,
				    })
				    nodemon.on('start', function () {
					  if(debug) console.log('LocalApp has started');
					  resolve({script,url})
					}).on('quit', function () {
					  if(debug) console.log('LocalApp has quit');
					  process.exit();
					}).on('restart', function (files) {
						if(debug) console.log('LocalApp restarted due to: ', files);
					});
        	});
		    
        }
  };
