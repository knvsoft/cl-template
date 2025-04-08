"use strict";

// MARK:- Globals
const defaultBodyId = 'clHtmlBody';
const bodyId = document.body.id ?? defaultBodyId;
const listTitleId = 'list-title';
const listTitle = $(`#${listTitleId}`);
const listCommentId = 'list-comment';
const editToggleId = 'cb-toggle-edit';
const listComment = $(`#${listCommentId}`);
const changesMenu = $('#changes-section');
const cbShowChanges = $('#show-changes');
const revision = parseInt(document.body.dataset.revision ?? "0");
const reportPrefix = `${bodyId}-${revision}`;
const selectorsForSettings = '#cb-show-menu, #cb-toggle-edit, #menu :is(input, select), #show-fields input';
const listSettingsStyleId = 'cl-css-vars';

const clStore = createStore('clDB', 'clStore');

// @ts-ignore
const elementMap = new Map([
  [listTitleId, $(`#${listTitleId}`)],
  [listCommentId, $(`#${listCommentId}`)],
  [changesMenu, $('#changes-section')],
  [cbShowChanges, $('#show-changes')]
]);

const $_ = document.documentElement;

function $(arg, startNode = document) {
  return startNode.querySelector.apply(startNode, [arg]);
}

function $$(query, $context = document) {
  let $nodes = query instanceof NodeList || Array.isArray(query)
    ? query
    : query instanceof HTMLElement || query instanceof SVGElement
      ? [query]
      : $context.querySelectorAll(query)

  if (!$nodes.length) $nodes = [];
  return Array.from($nodes);
}

function $id(arg, $context = document) {
  return $context.getElementById.apply($context, [arg]);
}

function $csValue(name, el = $_) {
  return getComputedStyle(el).getPropertyValue(name);
}

function $property(property, root = getComputedStyle(document.documentElement), clVars = $sheet(listSettingsStyleId)?.getRule(':where(html)').style) {
  return root.getPropertyValue(property) || clVars.getPropertyValue(property);
}

// Crude way to update, since outerHTML does not reflect changes from setProperty
function $setPropertyViaTextContent(name, value, styleElement) {
  const regex = RegExp(name + ':[^;]+');
  if (regex.test(styleElement?.textContent)) {
    styleElement.textContent = styleElement.textContent.replace(regex, name + ': ' + value);
  }
}

function $sheet(id, doc = document) {
  const sheet = doc.styleSheets[id];
  if (!sheet) return undefined;
  return Object.assign(sheet,
    {
      getRule: function (selector = ':root') {
        // @ts-ignore
        return [...this.cssRules].find((r) => r['selectorText'] === selector);
      },
    }
  );
}

const $populateVars = (function () {
  const _reCssVar = /var\(\s*(--[^)\s]+)\s*\)/g;
  return function (text) {
    if (!(typeof text === 'string')) return text;
    return text?.replaceAll(_reCssVar, (match, p1) => $populateVars($property(p1)));
  }
})();

document.onreadystatechange = async () => {
  if (document.readyState === "complete") {
    await initApplication();
  }
};

async function initApplication() {

  $$('[data-js-req]').forEach(el => el.hidden = false);

  document.body.addEventListener('click', onClick);
  document.body.addEventListener('change', onChange);
  $('input[type=range]')?.addEventListener('input', performAction);

  await loadSettings();
}

function onClick(event) {
  if (event.target instanceof HTMLButtonElement) {
    performAction(event);
  }
}

async function onChange(event) {
  performAction(event);
  await saveSettings(selectorsForSettings, reportPrefix);
  if (event.target && event.target.id === editToggleId) {
    window.location.reload();
  }
}

async function performAction(eventOrElement) {

  const input = eventOrElement.target || eventOrElement;
  const action = getAction(input);

  switch (action) {

    case 'toggleMenu':
    case 'toggleField':
    case 'toggleLayout':
      toggleClass(input);
      break;

    case 'setNarrowWidth':
      $setPropertyViaTextContent('--h-card-narrow-width', input.value, $id(listSettingsStyleId));
      break;

    case 'setBodyFont':
      $setPropertyViaTextContent('--body-font',
        $csValue('font-family', document.body), $id(listSettingsStyleId));
      break;

    case 'setFontSize':
      $setPropertyViaTextContent('--field-font-size', input.value, $id(listSettingsStyleId));
      break;

    case 'setTheme':
      // @ts-ignore
      document.firstElementChild.dataset.theme = input.value;
      document.body.dataset.theme = input.value;
      break;

    case 'resetChanges':
      await resetChanges(false);
      notify(input, true);
      break;

    case 'resetAll':
      await resetChanges(true);
      notify(input, true);
      break;

    default:
      globalThis[action]?.apply(this, arguments);
  }
}

function getAction(input) {
  return input?.closest('[data-action]')?.dataset.action;
}

/**
* Toggles class on target(s) based on checked status of checkbox or radio button.
*
* @param eventOrInput
* @returns true if completed
*
* Required attributes:
*  for checkbox: data-target(s), value = className
*  for radio buttons: name, value = className
*  for fieldset or form containing radio buttons: data-target(s)
*/
function toggleClass(input) {
  if (!(input instanceof HTMLInputElement) || !/(checkbox|radio)/.test(input.type)
    || ((input.type === 'radio') && !input.name))
    return false;

  const targets = getTargets(input);
  // @ts-ignore
  const inputElements = input.type === 'checkbox' ? [input] : input.getRootNode().querySelectorAll(`[name="${input.name}"][type=radio]`);
  addOrRemoveClass(targets, inputElements);
  return true;
}

function getTargets(input, context = document) {
  let node;

  if (node = context.querySelector(input.closest('[data-target]')?.dataset.target))
    return [node];

  return Array.from(context.querySelectorAll(input.closest('[data-targets]')?.dataset.targets));
}

function getClassName(input, defaultName = 'show') {
  return /(on|off)/.test(input.value) ? defaultName : input.value;
}

function addOrRemoveClass(targets, inputs) {
  targets.forEach(target =>
    inputs.forEach(input =>
      target.classList[input.checked ? 'add' : 'remove'](getClassName(input)))
  );
}

function toggleContentEditable(input) {
  const attr = 'contenteditable';
  const isOn = (input.target && input.target.checked) || input.checked;
  Array.from(document.getElementsByClassName('editable')).forEach((e) => {
    if (isOn)
      e.setAttribute(attr, '');
    else
      e.removeAttribute(attr)
  })
}

// MARK: - settings

async function saveSettings(selectorForSaving, reportPrefix) {
  const settings = $$(selectorForSaving)
    .filter(el => el.id)
    .reduce((acc, cur) =>
      // @ts-ignore
      acc.set(cur.id, [cur.type, cur.checked, cur.value]), new Map()
    );
  await set(`${reportPrefix}-settings`, settings, clStore);
}

async function applyDefaultsSettings() {
  $id('menu')?.classList.remove('show');
}

async function loadSettings() {
  const settings = await get(`${reportPrefix}-settings`, clStore);
  if (!settings) {
    await applyDefaultsSettings();
    return;
  }

  let type, checked, value;
  settings.forEach((values, id) => {
    [type, checked, value] = values;
    if (id) {
      const element = $(`#${id}`);
      if (element instanceof HTMLInputElement) {
        switch (type) {
          case "checkbox":
          case "radio":
            element.checked = checked;
            break;
          default:
            element.value = value;
        }
      } else if (element instanceof HTMLSelectElement) {
        element.value = value;
      }
      performAction(element);
    }
  });
}

async function resetChanges(forAllReports = false) {
  if (forAllReports) {
    clear(clStore);
  } else {
    const allKeys = await keys(clStore);
    const keysForThisList = allKeys.filter((key) => key.startsWith(reportPrefix));
    await delMany(keysForThisList, clStore);
  }
}

function notify(event, reload) {
  const notice = event?.querySelector("[data-notice]");
  const announce = $id("announce");
  if (notice) {
    let noticeText = notice.dataset.notice;
    if (typeof announce !== "undefined") {
      announce.setAttribute("aria-label", noticeText);
    }
    notice.textContent = noticeText;
    notice.hidden = false;
    setTimeout(function (reload) {
      if (typeof announce !== "undefined") {
        announce.setAttribute("aria-label", "");
      }
      notice.hidden = true;
      if (reload) {
        setTimeout(function () {
          location.reload();
        }, 300);
      }
    }, 1000, reload);
  }
}


// MARK: - FilterInputElement
//
// github/filter-input-element: Display elements in a subtree that match filter input text.
// (https://github.com/github/filter-input-element)

class FilterInputElement extends HTMLElement {
  constructor() {
    super();
    this.currentQuery = null;
    this.filter = null;
    this.debounceInputChange = debounce(() => filterResults(this, true));
    this.boundFilterResults = () => {
      filterResults(this, false);
    };
  }
  static get observedAttributes() {
    return ['aria-owns'];
  }
  attributeChangedCallback(name, oldValue) {
    if (oldValue && name === 'aria-owns') {
      filterResults(this, false);
    }
  }
  connectedCallback() {
    const input = this.input;
    if (!input)
      return;
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('spellcheck', 'false');
    input.addEventListener('focus', this.boundFilterResults);
    input.addEventListener('change', this.boundFilterResults);
    input.addEventListener('input', this.debounceInputChange);
  }
  disconnectedCallback() {
    const input = this.input;
    if (!input)
      return;
    input.removeEventListener('focus', this.boundFilterResults);
    input.removeEventListener('change', this.boundFilterResults);
    input.removeEventListener('input', this.debounceInputChange);
  }
  get input() {
    const input = this.querySelector('input');
    return input instanceof HTMLInputElement ? input : null;
  }
  reset() {
    const input = this.input;
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}
async function filterResults(filterInput, checkCurrentQuery = false) {
  const input = filterInput.input;
  if (!input)
    return;
  const query = input.value.trim();
  const id = filterInput.getAttribute('aria-owns');
  if (!id)
    return;
  const container = document.getElementById(id);
  if (!container)
    return;
  const list = container.hasAttribute('data-filter-list') ? container : container.querySelector('[data-filter-list]');
  if (!list)
    return;
  filterInput.dispatchEvent(new CustomEvent('filter-input-start', {
    bubbles: true
  }));
  if (checkCurrentQuery && filterInput.currentQuery === query)
    return;
  filterInput.currentQuery = query;
  const filter = filterInput.filter || matchSubstring;
  const total = list.childElementCount;
  let count = 0;
  let hideNew = false;
  for (const item of Array.from(list.children)) {
    if (!(item instanceof HTMLElement))
      continue;
    const itemText = getText(item);
    const result = filter(item, itemText, query);
    if (result.hideNew === true)
      hideNew = result.hideNew;
    item.hidden = !result.match;
    if (result.match)
      count++;
  }
  const newItem = container.querySelector('[data-filter-new-item]');
  const showCreateOption = !!newItem && query.length > 0 && !hideNew;
  if (newItem instanceof HTMLElement) {
    newItem.hidden = !showCreateOption;
    if (showCreateOption)
      updateNewItem(newItem, query);
  }
  toggleBlankslate(container, count > 0 || showCreateOption);
  filterInput.dispatchEvent(new CustomEvent('filter-input-updated', {
    bubbles: true,
    detail: {
      count,
      total
    }
  }));
}
function matchSubstring(_item, itemText, query) {
  const match = itemText.toLowerCase().indexOf(query.toLowerCase()) !== -1;
  return {
    match,
    hideNew: itemText === query
  };
}
function getTextFromCard(hCard) {
  if (hCard instanceof HTMLElement && hCard.classList.contains("h-card")) {
    // @ts-ignore
    const pName = $$(".p-name", hCard)[0]?.textContent || "";
    // @ts-ignore
    const values = $$("dl", hCard)
      .filter((e) => getComputedStyle(e).display !== 'none')
      .flatMap((e) => $$('dd', e))
      .map((e) => e.textContent).filter((e) => e.trim().length)
    return [pName, ...values].join("\n");
  }
  return undefined;
}
function getText(filterableItem) {
  const textContent = getTextFromCard(filterableItem);
  if (textContent) return textContent;
  const target = filterableItem.querySelector('[data-filter-item-text]') || filterableItem;
  return (target.textContent || '').trim();
}
function updateNewItem(newItem, query) {
  const newItemText = newItem.querySelector('[data-filter-new-item-text]');
  if (newItemText)
    newItemText.textContent = query;
  const newItemValue = newItem.querySelector('[data-filter-new-item-value]');
  if (newItemValue instanceof HTMLInputElement || newItemValue instanceof HTMLButtonElement) {
    newItemValue.value = query;
  }
}
function toggleBlankslate(container, force) {
  const emptyState = container.querySelector('[data-filter-empty-state]');
  if (emptyState instanceof HTMLElement)
    emptyState.hidden = force;
}
function debounce(callback) {
  let timeout;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      clearTimeout(timeout);
      callback();
    }, 300);
  };
}

if (!window.customElements.get('filter-input')) {
  // @ts-ignore
  window.FilterInputElement = FilterInputElement;
  window.customElements.define('filter-input', FilterInputElement);
}

// https://github.com/jakearchibald/idb-keyval
function promisifyRequest(e) { return new Promise(((t, r) => { e.oncomplete = e.onsuccess = () => t(e.result), e.onabort = e.onerror = () => r(e.error) })) } function createStore(e, t) { const r = indexedDB.open(e); r.onupgradeneeded = () => r.result.createObjectStore(t); const n = promisifyRequest(r); return (e, r) => n.then((n => r(n.transaction(t, e).objectStore(t)))) } let defaultGetStoreFunc; function defaultGetStore() { return defaultGetStoreFunc || (defaultGetStoreFunc = createStore("keyval-store", "keyval")), defaultGetStoreFunc } function get(e, t = defaultGetStore()) { return t("readonly", (t => promisifyRequest(t.get(e)))) } function set(e, t, r = defaultGetStore()) { return r("readwrite", (r => (r.put(t, e), promisifyRequest(r.transaction)))) } function setMany(e, t = defaultGetStore()) { return t("readwrite", (t => (e.forEach((e => t.put(e[1], e[0]))), promisifyRequest(t.transaction)))) } function getMany(e, t = defaultGetStore()) { return t("readonly", (t => Promise.all(e.map((e => promisifyRequest(t.get(e))))))) } function update(e, t, r = defaultGetStore()) { return r("readwrite", (r => new Promise(((n, u) => { r.get(e).onsuccess = function () { try { r.put(t(this.result), e), n(promisifyRequest(r.transaction)) } catch (e) { u(e) } } })))) } function del(e, t = defaultGetStore()) { return t("readwrite", (t => (t.delete(e), promisifyRequest(t.transaction)))) } function delMany(e, t = defaultGetStore()) { return t("readwrite", (t => (e.forEach((e => t.delete(e))), promisifyRequest(t.transaction)))) } function clear(e = defaultGetStore()) { return e("readwrite", (e => (e.clear(), promisifyRequest(e.transaction)))) } function eachCursor(e, t) { return e.openCursor().onsuccess = function () { this.result && (t(this.result), this.result.continue()) }, promisifyRequest(e.transaction) } function keys(e = defaultGetStore()) { return e("readonly", (e => { if (e.getAllKeys) return promisifyRequest(e.getAllKeys()); const t = []; return eachCursor(e, (e => t.push(e.key))).then((() => t)) })) } function values(e = defaultGetStore()) { return e("readonly", (e => { if (e.getAll) return promisifyRequest(e.getAll()); const t = []; return eachCursor(e, (e => t.push(e.value))).then((() => t)) })) } function entries(e = defaultGetStore()) { return e("readonly", (t => { if (t.getAll && t.getAllKeys) return Promise.all([promisifyRequest(t.getAllKeys()), promisifyRequest(t.getAll())]).then((([e, t]) => e.map(((e, r) => [e, t[r]])))); const r = []; return e("readonly", (e => eachCursor(e, (e => r.push([e.key, e.value]))).then((() => r)))) })) }
