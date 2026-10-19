// Each API process may run this loop; row locks and idempotency protect shared work.
function startLineWorker({pool,service,sheets,interval=15000}){
 let busy=false,stopped=false;
 async function tick(){if(busy||stopped)return;busy=true;try{await service.drain();if(sheets)await sheets.drain();}catch(e){if(e.code==='ER_NO_SUCH_TABLE'){console.warn('LINE import: run backend/line/migrate.js before enabling the worker');stop();}else console.warn('LINE import worker:',e.code||'WORKER_FAILED');}finally{busy=false;}}
 const timer=setInterval(tick,interval);timer.unref();function stop(){stopped=true;clearInterval(timer);}tick();return {stop,tick};
}
module.exports={startLineWorker};

