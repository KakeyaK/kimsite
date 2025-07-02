// Web Worker for CPU stress
self.onmessage = function(e) {
  if (e.data === 'start') {
    self.stress = true;
    function loop() {
      let t = Date.now();
      while (Date.now() - t < 50 && self.stress) {
        Math.sqrt(Math.random() * 1e8);
      }
      if (self.stress) setTimeout(loop, 0);
    }
    loop();
  } else if (e.data === 'stop') {
    self.stress = false;
    self.close();
  }
};
