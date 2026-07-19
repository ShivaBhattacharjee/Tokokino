var createDav1dDecoder = (() => {
  var _scriptDir = import.meta.url

  return function (moduleArg = {}) {
    var a = moduleArg,
      p,
      u,
      readyPromise = new Promise((b, c) => {
        p = b
        u = c
      }),
      z = Object.assign({}, a),
      A = ""
    "undefined" != typeof document &&
      document.currentScript &&
      (A = document.currentScript.src)
    _scriptDir && (A = _scriptDir)
    A.startsWith("blob:")
      ? (A = "")
      : (A = A.substr(0, A.replace(/[?#].*/, "").lastIndexOf("/") + 1))
    var aa = a.print || console.log.bind(console),
      B = a.printErr || console.error.bind(console)
    Object.assign(a, z)
    z = null
    var G
    a.wasmBinary && (G = a.wasmBinary)
    var I,
      ba = !1,
      J,
      L
    function ca() {
      var b = I.buffer
      a.HEAP8 = new Int8Array(b)
      a.HEAP16 = new Int16Array(b)
      a.HEAPU8 = J = new Uint8Array(b)
      a.HEAPU16 = new Uint16Array(b)
      a.HEAP32 = new Int32Array(b)
      a.HEAPU32 = L = new Uint32Array(b)
      a.HEAPF32 = new Float32Array(b)
      a.HEAPF64 = new Float64Array(b)
    }
    var da = [],
      ea = [],
      fa = []
    function ha() {
      var b = a.preRun.shift()
      da.unshift(b)
    }
    var M = 0,
      N = null,
      O = null
    function ia(b) {
      a.onAbort?.(b)
      b = "Aborted(" + b + ")"
      B(b)
      ba = !0
      b = new WebAssembly.RuntimeError(
        b + ". Build with -sASSERTIONS for more info."
      )
      u(b)
      throw b
    }
    var ja = (b) => b.startsWith("data:application/octet-stream;base64,"),
      R
    if (a.locateFile) {
      if (((R = "tokokino-dav1d.wasm"), !ja(R))) {
        var ka = R
        R = a.locateFile ? a.locateFile(ka, A) : A + ka
      }
    } else R = A + "tokokino-dav1d.wasm"
    function la(b) {
      if (b == R && G) return new Uint8Array(G)
      throw "both async and sync fetching of the wasm failed"
    }
    function xa(b) {
      return G || "function" != typeof fetch
        ? Promise.resolve().then(() => la(b))
        : fetch(b, { credentials: "same-origin" })
            .then((c) => {
              if (!c.ok) throw `failed to load wasm binary file at '${b}'`
              return c.arrayBuffer()
            })
            .catch(() => la(b))
    }
    function ya(b, c, d) {
      return xa(b)
        .then((e) => WebAssembly.instantiate(e, c))
        .then(d, (e) => {
          B(`failed to asynchronously prepare wasm: ${e}`)
          ia(e)
        })
    }
    function za(b, c) {
      var d = R
      return G ||
        "function" != typeof WebAssembly.instantiateStreaming ||
        ja(d) ||
        "function" != typeof fetch
        ? ya(d, b, c)
        : fetch(d, { credentials: "same-origin" }).then((e) =>
            WebAssembly.instantiateStreaming(e, b).then(c, function (g) {
              B(`wasm streaming compile failed: ${g}`)
              B("falling back to ArrayBuffer instantiation")
              return ya(d, b, c)
            })
          )
    }
    var S = (b) => {
        for (; 0 < b.length; ) b.shift()(a)
      },
      Aa = [null, [], []],
      Ba = "undefined" != typeof TextDecoder ? new TextDecoder("utf8") : void 0,
      Ca = {
        _emscripten_memcpy_js: (b, c, d) => J.copyWithin(b, c, c + d),
        abort: () => {
          ia("")
        },
        emscripten_get_heap_max: () => 2147483648,
        emscripten_resize_heap: (b) => {
          var c = J.length
          b >>>= 0
          if (2147483648 < b) return !1
          for (var d = 1; 4 >= d; d *= 2) {
            var e = c * (1 + 0.2 / d)
            e = Math.min(e, b + 100663296)
            var g = Math
            e = Math.max(b, e)
            a: {
              g =
                (g.min.call(
                  g,
                  2147483648,
                  e + ((65536 - (e % 65536)) % 65536)
                ) -
                  I.buffer.byteLength +
                  65535) /
                65536
              try {
                I.grow(g)
                ca()
                var n = 1
                break a
              } catch (v) {}
              n = void 0
            }
            if (n) return !0
          }
          return !1
        },
        fd_close: () => 52,
        fd_seek: function () {
          return 70
        },
        fd_write: (b, c, d, e) => {
          for (var g = 0, n = 0; n < d; n++) {
            var v = L[c >> 2],
              r = L[(c + 4) >> 2]
            c += 8
            for (var x = 0; x < r; x++) {
              var f = J[v + x],
                w = Aa[b]
              if (0 === f || 10 === f) {
                f = w
                for (var l = 0, q = l + NaN, t = l; f[t] && !(t >= q); ) ++t
                if (16 < t - l && f.buffer && Ba)
                  f = Ba.decode(f.subarray(l, t))
                else {
                  for (q = ""; l < t; ) {
                    var h = f[l++]
                    if (h & 128) {
                      var C = f[l++] & 63
                      if (192 == (h & 224))
                        q += String.fromCharCode(((h & 31) << 6) | C)
                      else {
                        var P = f[l++] & 63
                        h =
                          224 == (h & 240)
                            ? ((h & 15) << 12) | (C << 6) | P
                            : ((h & 7) << 18) |
                              (C << 12) |
                              (P << 6) |
                              (f[l++] & 63)
                        65536 > h
                          ? (q += String.fromCharCode(h))
                          : ((h -= 65536),
                            (q += String.fromCharCode(
                              55296 | (h >> 10),
                              56320 | (h & 1023)
                            )))
                      }
                    } else q += String.fromCharCode(h)
                  }
                  f = q
                }
                ;(1 === b ? aa : B)(f)
                w.length = 0
              } else w.push(f)
            }
            g += r
          }
          L[e >> 2] = g
          return 0
        },
        ogvjs_callback_frame: function (
          b,
          c,
          d,
          e,
          g,
          n,
          v,
          r,
          x,
          f,
          w,
          l,
          q,
          t,
          h,
          C,
          P
        ) {
          function V(H, k, D, ma, na, oa, Ea, Fa, Q) {
            H.set(new Uint8Array(Ga, k, D * ma))
            var E, y
            for (E = y = 0; E < oa; E++, y += D)
              for (k = 0; k < D; k++) H[y + k] = Q
            for (; E < oa + Fa; E++, y += D) {
              for (k = 0; k < na; k++) H[y + k] = Q
              for (k = na + Ea; k < D; k++) H[y + k] = Q
            }
            for (; E < ma; E++, y += D) for (k = 0; k < D; k++) H[y + k] = Q
            return H
          }
          var Ga = I.buffer,
            m = a.videoFormat,
            pa = ((q & -2) * x) / v,
            qa = ((t & -2) * f) / r,
            ra = (w * x) / v,
            sa = (l * f) / r
          w === m.cropWidth &&
            l === m.cropHeight &&
            ((h = m.displayWidth), (C = m.displayHeight))
          for (
            var ta = a.recycledFrames, F, ua = r * c, va = f * e, wa = f * n;
            0 < ta.length;
          ) {
            var K = ta.shift()
            m = K.format
            if (
              m.width === v &&
              m.height === r &&
              m.chromaWidth === x &&
              m.chromaHeight === f &&
              m.cropLeft === q &&
              m.cropTop === t &&
              m.cropWidth === w &&
              m.cropHeight === l &&
              m.displayWidth === h &&
              m.displayHeight === C &&
              K.y.bytes.length === ua &&
              K.u.bytes.length === va &&
              K.v.bytes.length === wa
            ) {
              F = K
              break
            }
          }
          F ||= {
            format: {
              width: v,
              height: r,
              chromaWidth: x,
              chromaHeight: f,
              cropLeft: q,
              cropTop: t,
              cropWidth: w,
              cropHeight: l,
              displayWidth: h,
              displayHeight: C,
            },
            y: { bytes: new Uint8Array(ua), stride: c },
            u: { bytes: new Uint8Array(va), stride: e },
            v: { bytes: new Uint8Array(wa), stride: n },
          }
          V(F.y.bytes, b, c, r, q, t, w, l, 0)
          V(F.u.bytes, d, e, f, pa, qa, ra, sa, 128)
          V(F.v.bytes, g, n, f, pa, qa, ra, sa, 128)
          F.packetId = P
          a.frameQueue.push(F)
        },
      },
      T = (function () {
        function b(d) {
          T = d.exports
          I = T.memory
          ca()
          ea.unshift(T.__wasm_call_ctors)
          M--
          a.monitorRunDependencies?.(M)
          0 == M &&
            (null !== N && (clearInterval(N), (N = null)),
            O && ((d = O), (O = null), d()))
          return T
        }
        var c = { env: Ca, wasi_snapshot_preview1: Ca }
        M++
        a.monitorRunDependencies?.(M)
        if (a.instantiateWasm)
          try {
            return a.instantiateWasm(c, b)
          } catch (d) {
            ;(B(`Module.instantiateWasm callback failed with error: ${d}`),
              u(d))
          }
        za(c, function (d) {
          b(d.instance)
        }).catch(u)
        return {}
      })()
    a._ogv_video_decoder_init = () =>
      (a._ogv_video_decoder_init = T.ogv_video_decoder_init)()
    a._ogv_video_decoder_async = () =>
      (a._ogv_video_decoder_async = T.ogv_video_decoder_async)()
    a._ogv_video_decoder_destroy = () =>
      (a._ogv_video_decoder_destroy = T.ogv_video_decoder_destroy)()
    a._ogv_video_decoder_process_header = (b, c) =>
      (a._ogv_video_decoder_process_header =
        T.ogv_video_decoder_process_header)(b, c)
    a._ogv_video_decoder_process_frame = (b, c) =>
      (a._ogv_video_decoder_process_frame = T.ogv_video_decoder_process_frame)(
        b,
        c
      )
    a._free = (b) => (a._free = T.free)(b)
    a._ogv_video_decoder_set_packet_id = (b) =>
      (a._ogv_video_decoder_set_packet_id = T.ogv_video_decoder_set_packet_id)(
        b
      )
    a._malloc = (b) => (a._malloc = T.malloc)(b)
    a.dynCall_jiji = (b, c, d, e, g) =>
      (a.dynCall_jiji = T.dynCall_jiji)(b, c, d, e, g)
    var U
    O = function Da() {
      U || Ha()
      U || (O = Da)
    }
    function Ha() {
      function b() {
        if (!U && ((U = !0), (a.calledRun = !0), !ba)) {
          S(ea)
          p(a)
          if (a.onRuntimeInitialized) a.onRuntimeInitialized()
          if (a.postRun)
            for (
              "function" == typeof a.postRun && (a.postRun = [a.postRun]);
              a.postRun.length;
            ) {
              var c = a.postRun.shift()
              fa.unshift(c)
            }
          S(fa)
        }
      }
      if (!(0 < M)) {
        if (a.preRun)
          for (
            "function" == typeof a.preRun && (a.preRun = [a.preRun]);
            a.preRun.length;
          )
            ha()
        S(da)
        0 < M ||
          (a.setStatus
            ? (a.setStatus("Running..."),
              setTimeout(function () {
                setTimeout(function () {
                  a.setStatus("")
                }, 1)
                b()
              }, 1))
            : b())
      }
    }
    if (a.preInit)
      for (
        "function" == typeof a.preInit && (a.preInit = [a.preInit]);
        0 < a.preInit.length;
      )
        a.preInit.pop()()
    Ha()
    var W, X, Y
    Y =
      "undefined" === typeof performance ||
      "undefined" === typeof performance.now
        ? Date.now
        : performance.now.bind(performance)
    function Z(b) {
      var c = Y()
      b = b()
      a.cpuTime += Y() - c
      return b
    }
    a.loadedMetadata = !!a.videoFormat
    a.videoFormat = a.videoFormat || null
    a.frameBuffer = null
    a.frameQueue = []
    a.cpuTime = 0
    Object.defineProperty(a, "processing", {
      get: function () {
        return !1
      },
    })
    a.init = function (b) {
      Z(function () {
        a._ogv_video_decoder_init()
      })
      b()
    }
    a.processHeader = function (b, c) {
      var d = Z(function () {
        var e = b.byteLength
        ;(W && X >= e) || (W && a._free(W), (X = e), (W = a._malloc(X)))
        var g = W
        new Uint8Array(I.buffer, g, e).set(new Uint8Array(b))
        return a._ogv_video_decoder_process_header(g, e)
      })
      c(d)
    }
    a.g = []
    a.processFrame = function (b, c) {
      function d(r) {
        n && a._free(n)
        a.frameBuffer = a.frameQueue.shift() || null
        c(a.frameBuffer ? 1 : r)
      }
      if (null === b && 0 < a.frameQueue.length)
        ((a.frameBuffer = a.frameQueue.shift()), c(1))
      else {
        var e = a._ogv_video_decoder_async(),
          g = b ? b.byteLength : 0,
          n = g ? a._malloc(g) : 0
        e && a.g.push(d)
        var v = Z(function () {
          b && new Uint8Array(I.buffer, n, g).set(new Uint8Array(b))
          return a._ogv_video_decoder_process_frame(n, g)
        })
        e || d(v)
      }
    }
    a.setPacketId = function (b) {
      a._ogv_video_decoder_set_packet_id(b)
    }
    a.close = function () {}
    a.sync = function () {
      a._ogv_video_decoder_async() &&
        (a.g.push(function () {}),
        Z(function () {
          a._ogv_video_decoder_process_frame(0, 0)
        }))
    }
    a.recycledFrames = []
    a.recycleFrame = function (b) {
      var c = a.recycledFrames
      c.push(b)
      16 < c.length && c.shift()
    }

    return readyPromise
  }
})()
export default createDav1dDecoder
