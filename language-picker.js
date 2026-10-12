const languageTags = { USen: 'en', CNzh: 'zh-CN', JPja: 'ja' };

// Keep the native select as the source of truth for the existing translation code.
for (const select of document.querySelectorAll('#ui-language, #resource-language')) {
    const picker = document.createElement('div');
    picker.className = 'language-picker';
    const trigger = document.createElement('button');
    trigger.className = 'language-picker-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    const caret = document.createElement('span');
    caret.className = 'language-picker-caret';
    caret.setAttribute('aria-hidden', 'true');
    trigger.append(label, caret);
    const menu = document.createElement('div');
    menu.className = 'language-picker-menu';
    menu.id = select.id + '-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    trigger.setAttribute('aria-controls', menu.id);
    const options = [...select.options].map(option => {
        const button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'option');
        button.dataset.value = option.value;
        button.lang = languageTags[option.value] || 'en';
        button.textContent = option.textContent;
        button.addEventListener('click', () => {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            refresh();
            close(true);
        });
        menu.append(button);
        return button;
    });

    function refresh() {
        label.textContent = select.selectedOptions[0]?.textContent;
        trigger.lang = languageTags[select.value] || 'en';
        const name = select.getAttribute('aria-label') || 'Language';
        trigger.setAttribute('aria-label', name + ': ' + label.textContent);
        menu.setAttribute('aria-label', name);
        options.forEach(button => button.setAttribute('aria-selected', String(button.dataset.value === select.value)));
    }
    function close(returnFocus = false) {
        menu.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
        if (returnFocus) trigger.focus();
    }
    function open() {
        refresh();
        menu.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        (options.find(button => button.dataset.value === select.value) || options[0]).focus();
    }
    trigger.addEventListener('click', () => menu.hidden ? open() : close());
    trigger.addEventListener('keydown', event => {
        if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            open();
        }
    });
    menu.addEventListener('keydown', event => {
        const index = options.indexOf(document.activeElement);
        let next;
        if (event.key === 'ArrowDown') next = (index + 1) % options.length;
        if (event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = options.length - 1;
        if (next !== undefined) {
            event.preventDefault();
            options[next].focus();
        }
        if (event.key === 'Escape') { event.preventDefault(); close(true); }
    });
    // Safari can blur a button before its tap becomes a click, without
    // assigning focus to the tapped option. Close on a confirmed outside
    // focus instead so the option remains available for the click.
    document.addEventListener('focusin', event => {
        if (!picker.contains(event.target)) close();
    });
    document.addEventListener('pointerdown', event => {
        if (!picker.contains(event.target)) close();
    });
    select.addEventListener('change', refresh);
    select.addEventListener('language-picker-sync', refresh);
    new MutationObserver(refresh).observe(select, { attributes: true, attributeFilter: ['aria-label'] });
    picker.append(trigger, menu);
    select.after(picker);
    select.hidden = true;
    refresh();
}
