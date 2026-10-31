(function () {
  'use strict';
  if (window.ccShrink) return;
  window.ccShrink = function (file) {
    return new Promise(function (ok, bad) {
      var MR = window.MediaRecorder, v = document.createElement('video'), cv = document.createElement('canvas');
      if (!MR || !cv.captureStream) return bad(new Error('This phone cannot shrink videos. Trim it under 25 MB and try again.'));
      var mime = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'].filter(function (t) { try { return MR.isTypeSupported(t); } catch (e) { return false; } })[0];
      if (!mime) return bad(new Error('This phone cannot shrink videos. Trim it under 25 MB and try again.'));
      var base = /mp4/.test(mime) ? 'video/mp4' : 'video/webm', ext = base === 'video/mp4' ? '.mp4' : '.webm';
      var url = URL.createObjectURL(file), done = false, rec, ac, chunks = [], last = Date.now(), wd;
      function end(err, f) {
        if (done) return; done = true; clearInterval(wd);
        try { v.pause(); } catch (e) {} try { if (ac) ac.close(); } catch (e) {} URL.revokeObjectURL(url);
        err ? bad(err) : ok(f);
      }
      v.playsInline = true; v.preload = 'auto'; v.src = url;
      v.onerror = function () { end(new Error('Could not read that video. Try another one.')); };
      v.onloadedmetadata = function () {
        if (isFinite(v.duration) && v.duration > 90) return end(new Error('Stories can be up to 90 seconds. Trim it and try again.'));
        var r = Math.min(1, 720 / Math.max(v.videoWidth || 720, v.videoHeight || 720));
        cv.width = Math.max(2, Math.round((v.videoWidth || 720) * r / 2) * 2); cv.height = Math.max(2, Math.round((v.videoHeight || 720) * r / 2) * 2);
        var ctx = cv.getContext('2d'), stream = cv.captureStream(30);
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC) { ac = new AC(); var dest = ac.createMediaStreamDestination(); ac.createMediaElementSource(v).connect(dest); dest.stream.getAudioTracks().forEach(function (t) { stream.addTrack(t); }); ac.resume(); }
        } catch (e) {}
        try { rec = new MR(stream, { mimeType: mime, videoBitsPerSecond: 1600000, audioBitsPerSecond: 96000 }); } catch (e) { return end(new Error('This phone cannot shrink videos. Trim it under 25 MB and try again.')); }
        rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
        rec.onstop = function () {
          var blob = new Blob(chunks, { type: base });
          if (!blob.size) return end(new Error('Could not shrink that video. Try another one.'));
          end(null, new File([blob], (file.name || 'story').replace(/\.[^.]+$/, '') + ext, { type: base }));
        };
        function draw() { if (done) return; last = Date.now(); try { ctx.drawImage(v, 0, 0, cv.width, cv.height); } catch (e) {} v.requestVideoFrameCallback ? v.requestVideoFrameCallback(draw) : requestAnimationFrame(draw); }
        v.onended = function () { try { rec.state !== 'inactive' && rec.stop(); } catch (e) {} };
        wd = setInterval(function () { if (Date.now() - last > 15000) end(new Error('Shrinking stopped. Keep the screen open and try again.')); }, 3000);
        rec.start(1000);
        var p = v.play(); if (p && p.catch) p.catch(function () { v.muted = true; v.play().catch(function () { end(new Error('Could not play the video to shrink it. Try again.')); }); });
        draw();
      };
    });
  };
})();
