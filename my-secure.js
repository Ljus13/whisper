(function() {
    var C = new Object();
    C[ "tid" ] = '6027';
    C[ "p1" ] = 'aHR0cHM6Ly9kb2NzLmdvb2dsZS5jb20vc3ByZWFkc2hlZXRzL2QvZS8yUEFDWC0xdlFnS05ISnBNRWtCVjJONFAxSkhfZnZ0Q1NkR0U1';
    C[ "p2" ] = 'a3gyMnlqeEQzWkxNS3o4cFBtOEd5ZjRYMEhFcmtPWUxWZUpIRGg2Y1F0RGJxTGI3ai9wdWI/b3V0cHV0PWNzdg==';
    C[ "sk" ] = 'thread_vault_';

    var storagePath = C[ "sk" ] + C[ "tid" ];
    
    var initSecureGate = function() {
        var isPassed = localStorage.getItem(storagePath) === 'unlocked';
        var gateEl = document.getElementById('SECURE_GATE');
        
        if (isPassed) {
            var g = document.getElementById('SECURE_GATE');
            if (g) g.remove();
            document.body.style.overflow = 'auto';
            return;
        }

        if (!gateEl) {
            setTimeout(initSecureGate, 100);
            return;
        }

        gateEl.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        var nodeEl = document.getElementById('NODE_ID');
        if (nodeEl) nodeEl.innerText = 'TID : ' + C[ "tid" ];

        var setStatus = function(txt, icon, isErr) {
            var msg = document.getElementById('GATE_MSG');
            if (!msg) return;
            msg.innerHTML = '<i class="fi ' + icon + '" style="margin-right : 5px;"></i> > ' + txt;
            msg.style.color = isErr ? '#ff4b5c' : '#4f6a85';
        };

        var authorizeNode = async function() {
            var btn = document.getElementById('GATE_BTN');
            var input = document.getElementById('GATE_PASS');
            var val = input.value.trim();

            if (!val) {
                setStatus('ERROR : NULL_PAYLOAD', 'fi-rr-warning', true);
                return;
            }

            btn.disabled = true;
            btn.innerHTML = 'PROCESSING...';
            setStatus('PULLING REMOTE DATA...', 'fi-rr-cloud-share', false);

            try {
                var url = atob(C[ "p1" ] + C[ "p2" ]);
                var res = await fetch(url, { cache : 'no-store' });
                var raw = await res.text();
                
                if (raw.toLowerCase().indexOf('<html') !== -1) {
                    setStatus('SYSTEM RESTRICTED', 'fi-rr-ban', true);
                    btn.disabled = false;
                    btn.innerHTML = 'Retry Access';
                    return;
                }

                var clean = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
                var rows = clean.split('\n').filter(function(l){ return l.trim() !== ""; });
                
                if (rows.length < 1) throw new Error("EMPTY");

                var headers = rows[0].split(',').map(function(h){ return h.trim().toLowerCase(); });
                var tidIdx = headers.indexOf('tid') !== -1 ? headers.indexOf('tid') : 0;
                var passIdx = headers.indexOf('password') !== -1 ? headers.indexOf('password') : (headers.indexOf('pass') !== -1 ? headers.indexOf('pass') : 2);
                var statIdx = headers.indexOf('status') !== -1 ? headers.indexOf('status') : (headers.indexOf('stat') !== -1 ? headers.indexOf('stat') : 3);

                var matched = null;
                for (var i = 1; i < rows.length; i++) {
                    var cols = rows[ i ].split(',').map(function(c){ return c.replace(/^"|"$/g, '').trim(); });
                    if (String(cols[ tidIdx ]) === String(C[ "tid" ])) {
                        matched = new Object();
                        matched[ "pass" ] = cols[ passIdx ] || "";
                        matched[ "stat" ] = (cols[ statIdx ] || "active").toLowerCase();
                        break;
                    }
                }

                if (matched) {
                    if (matched[ "stat" ] !== 'active') {
                        setStatus('ERROR : SUSPENDED', 'fi-rr-ban', true);
                        btn.innerHTML = 'DENIED';
                        return;
                    }

                    if (matched[ "pass" ] === val) {
                        localStorage.setItem(storagePath, 'unlocked');
                        setStatus('ACCESS GRANTED', 'fi-rr-check', false);
                        gateEl.style.opacity = '0';
                        setTimeout(function(){
                            gateEl.remove();
                            document.body.removeAttribute('style');
                            document.body.style.overflow = 'auto';
                        }, 500);
                    } else {
                        setStatus('INVALID PASSWORD', 'fi-rr-shield-exclamation', true);
                        btn.disabled = false;
                        btn.innerHTML = 'Authorize';
                    }
                } else {
                    setStatus('NODE NOT FOUND', 'fi-rr-search-alt', true);
                    btn.disabled = false;
                    btn.innerHTML = 'Retry';
                }
            } catch (e) {
                setStatus('HANDSHAKE FAILED', 'fi-rr-signal-alt-2', true);
                btn.disabled = false;
                btn.innerHTML = 'Retry';
            }
        };

        btn.onclick = authorizeNode;
        input.onkeypress = function(evt) {
            if (evt.key === 'Enter') authorizeNode();
        };
    };

    if (document.readyState === 'complete') {
        initSecureGate();
    } else {
        window.addEventListener('load', initSecureGate);
    }

    setInterval(function(){
        if (localStorage.getItem(storagePath) !== 'unlocked' && !document.getElementById('SECURE_GATE')) {
            window.location.href = 'https://roleplayth.com/';
        }
    }, 2500);
})();
