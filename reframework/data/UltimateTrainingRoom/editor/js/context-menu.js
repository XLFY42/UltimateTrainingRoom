/**
 * context-menu.js — 右键菜单创建/打开/关闭
 */

let $contextMenu = null;

export function initContextMenu(refs) {
  $contextMenu = refs.$contextMenu;

  $contextMenu.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });
}

/* ============================================================
   菜单项创建
   ============================================================ */
export function createContextMenuItem(def) {
  if (def.separator) {
    const sep = document.createElement('div');
    sep.className = 'context-menu-separator';
    return sep;
  }
  const item = document.createElement('div');
  item.className = 'context-menu-item' + (def.disabled ? ' disabled' : '');
  const label = document.createElement('span');
  label.textContent = def.label;
  item.appendChild(label);

  if (def.submenu?.length) {
    const arrow = document.createElement('span');
    arrow.className = 'context-menu-arrow';
    arrow.textContent = '\u25B6';
    item.appendChild(arrow);
    const submenu = document.createElement('div');
    submenu.className = 'context-submenu';
    def.submenu.forEach(sub => submenu.appendChild(createContextMenuItem(sub)));
    item.appendChild(submenu);
  } else if (!def.disabled && def.onClick) {
    item.addEventListener('click', () => {
      closeContextMenu();
      def.onClick();
    });
  }
  return item;
}

/* ============================================================
   打开/关闭
   ============================================================ */
export function openContextMenu(clientX, clientY, items) {
  $contextMenu.innerHTML = '';
  items.forEach(item => $contextMenu.appendChild(createContextMenuItem(item)));
  $contextMenu.classList.add('open');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  requestAnimationFrame(() => {
    const rect = $contextMenu.getBoundingClientRect();
    $contextMenu.style.left = `${Math.min(clientX, vw - rect.width - 8)}px`;
    $contextMenu.style.top = `${Math.min(clientY, vh - rect.height - 8)}px`;
  });
}

export function closeContextMenu() {
  $contextMenu.classList.remove('open');
  $contextMenu.innerHTML = '';
}
