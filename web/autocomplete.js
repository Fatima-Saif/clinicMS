window.initAutocomplete = function() {
    function setupInput(id, type) {
        const input = document.getElementById(id);
        if(!input) return;
        
        const listId = id + '-datalist';
        let datalist = document.getElementById(listId);
        if(!datalist) {
            datalist = document.createElement('datalist');
            datalist.id = listId;
            document.body.appendChild(datalist);
        }
        input.setAttribute('list', listId);

        input.addEventListener('focus', async () => {
            try {
                const res = await window.apiGet(`/suggestions?type=${type}`);
                if(res && res.success) {
                    datalist.innerHTML = '';
                    res.data.forEach(item => {
                        const opt = document.createElement('option');
                        opt.value = item;
                        datalist.appendChild(opt);
                    });
                }
            } catch(e) {}
        });
    }

    function setupTextarea(id, type) {
        const textarea = document.getElementById(id);
        if(!textarea) return;

        const listDiv = document.createElement('div');
        listDiv.style.position = 'absolute';
        listDiv.style.background = '#ffffff';
        listDiv.style.border = '1px solid #e2e8f0';
        listDiv.style.zIndex = '1000';
        listDiv.style.display = 'none';
        listDiv.style.maxHeight = '180px';
        listDiv.style.overflowY = 'auto';
        listDiv.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.1)';
        listDiv.style.borderRadius = '8px';
        
        if(textarea.parentNode) {
            textarea.parentNode.insertBefore(listDiv, textarea.nextSibling);
            if(window.getComputedStyle(textarea.parentNode).position === 'static') {
                textarea.parentNode.style.position = 'relative';
            }
        }

        let currentSuggestions = [];

        textarea.addEventListener('input', async (e) => {
            const val = textarea.value;
            // Get the last phrase being typed (after a comma, or newline, or just the whole thing)
            const parts = val.split(/[\n,]/);
            let lastPart = parts[parts.length - 1];
            if(!lastPart) { listDiv.style.display = 'none'; return; }
            
            const lastWord = lastPart.trim();
            if(lastWord.length < 2) { listDiv.style.display = 'none'; return; }
            
            try {
                const res = await window.apiGet(`/suggestions?type=${type}&q=${encodeURIComponent(lastWord)}`);
                if(res && res.success && res.data.length > 0) {
                    currentSuggestions = res.data;
                    listDiv.innerHTML = '';
                    currentSuggestions.forEach(s => {
                        const item = document.createElement('div');
                        item.textContent = s;
                        item.style.padding = '8px 12px';
                        item.style.cursor = 'pointer';
                        item.style.borderBottom = '1px solid #f1f5f9';
                        item.style.fontSize = '13px';
                        item.style.color = '#334155';
                        item.onmouseover = () => item.style.background = '#f8fafc';
                        item.onmouseout = () => item.style.background = '#ffffff';
                        item.onmousedown = (ev) => {
                            ev.preventDefault();
                            const replaceIndex = val.lastIndexOf(lastPart);
                            textarea.value = val.substring(0, replaceIndex) + (lastPart.startsWith(' ') ? ' ' : '') + s + ', ';
                            listDiv.style.display = 'none';
                            textarea.focus();
                        };
                        listDiv.appendChild(item);
                    });
                    
                    listDiv.style.top = (textarea.offsetTop + textarea.offsetHeight + 2) + 'px';
                    listDiv.style.left = textarea.offsetLeft + 'px';
                    listDiv.style.width = textarea.offsetWidth + 'px';
                    listDiv.style.display = 'block';
                } else {
                    listDiv.style.display = 'none';
                }
            } catch(e) {
                listDiv.style.display = 'none';
            }
        });
        
        textarea.addEventListener('blur', () => { setTimeout(() => listDiv.style.display = 'none', 200); });
    }

    setupInput('f-first-name', 'first_name');
    setupInput('f-guardian-name', 'guardian_name');
    setupInput('f-city', 'city');
    setupInput('f-address', 'address');
    
    setupTextarea('f-symptoms', 'symptoms');
    setupTextarea('f-medicines-text', 'medicines_text');
    setupTextarea('dash-quick-scratchpad', 'scratchpad');
};
