// kds.js - Sistema de Exibição de Cozinha (KDS) Profissional
// ========================================================
// Versão: 3.2 - Gestão de Itens e Subitens (Sabores/Opções)
// ========================================================

"use strict";

const newOrderSound = new Audio("beep.mp3");

class KDSManager {
  constructor() {
    this.ordersContainer = document.getElementById("ordersContainer");
    this.noOrdersMessage = document.getElementById("noOrdersMessage");
    this.historySidebar = document.getElementById("historySidebar");
    this.historyToggleBtn = document.getElementById("historyToggleBtn");
    this.historyContent = document.getElementById("historyContent");
    this.backdrop = document.getElementById("backdrop");
    this.historyTotalValue = document.getElementById("historyTotalValue");
    this.settingsSidebar = document.getElementById("settingsSidebar");
    this.settingsToggleBtn = document.getElementById("settingsToggleBtn");

    this.currentOrderId = null;
    this.alertInterval = null;
    this.notifSettings = {
      enabled: true,
      title: "Novo Pedido!",
      body: "Um novo pedido chegou à cozinha.",
    };

    this.init();
  }

  init() {
    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    this.loadNotifSettings();

    window.addEventListener("storage", (e) => {
      if (e.key === "kds_orders") {
        this.renderOrders();
        this.renderHistory();
      }
    });

    if (this.historyToggleBtn) {
      this.historyToggleBtn.onclick = () => this.toggleHistorySidebar();
    }
    if (this.settingsToggleBtn) {
      this.settingsToggleBtn.onclick = () => this.toggleSettingsSidebar();
    }

    newOrderSound.volume = localStorage.getItem("beepVolume") || 1;

    this.renderOrders();
    this.renderHistory();
    this.setupEventListeners();

    setInterval(() => this.updateTimers(), 60000);
  }

  loadNotifSettings() {
    const saved = localStorage.getItem("notifSettings");
    if (saved) this.notifSettings = JSON.parse(saved);
  }

  getOrders() {
    try {
      const orders = localStorage.getItem("kds_orders");
      return orders ? JSON.parse(orders) : [];
    } catch (e) {
      console.error("Erro ao ler pedidos:", e);
      return [];
    }
  }

  saveOrders(orders) {
    try {
      localStorage.setItem("kds_orders", JSON.stringify(orders));
      this.renderOrders();
      this.renderHistory();
    } catch (e) {
      console.error("Erro ao salvar pedidos:", e);
    }
  }

  renderOrders() {
    const allOrders = this.getOrders();
    const activeOrders = allOrders.filter((o) => o.status !== "Concluído");

    this.ordersContainer.innerHTML = "";

    if (activeOrders.length === 0) {
      if (this.noOrdersMessage) this.noOrdersMessage.style.display = "block";
      this.stopAlertSound();
      return;
    }

    if (this.noOrdersMessage) this.noOrdersMessage.style.display = "none";
    activeOrders.sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));

    activeOrders.forEach((order) => {
      const card = document.createElement("div");
      card.className = `order-card ${order.status.toLowerCase()}`;

      const consumo = order.tipoConsumo || "Local";
      const consumoClass =
        order.tipoConsumo === "Para Viagem" ? "badge-viagem" : "badge-local";
      const pagamentos = this.formatPayments(order.pagamentos);

      card.innerHTML = `
        <div class="order-header">
          <div>
            <strong>${order.nomeCliente}</strong>
            <span class="consumo-badge ${consumoClass}">${consumo}</span>
            <br><small>#${order.id.toString().slice(-4)}</small>
          </div>
          <span class="order-time">${
            order.dataHora.split(" ")[1] || order.dataHora
          }</span>
        </div>
        <div class="order-items">
          ${order.itens
            .map(
              (item) => `
            <div class="order-item">
              <strong>${item.quantity}x</strong> ${item.item}
              <div class="item-details">${this.formatDetails(item.custom)}</div>
            </div>
          `
            )
            .join("")}
        </div>
        ${
          order.observacao
            ? `<div class="order-obs"><strong>OBS:</strong> ${order.observacao}</div>`
            : ""
        }
        <div class="order-payment">
          <strong>Pagamento:</strong> ${pagamentos}
        </div>
        <div class="order-footer">
          <button class="accept-btn" onclick="acceptOrder('${order.id}')">
            ${order.status === "Pendente" ? "ACEITAR" : "CONCLUIR"}
          </button>
          <button class="obs-btn" onclick="openObservationModal('${
            order.id
          }')">OBS</button>
          <button class="print-btn" onclick="printOrder('${
            order.id
          }')">🖨️</button>
          <button class="delete-btn" onclick="deleteOrder('${
            order.id
          }')">❌</button>
        </div>
      `;
      this.ordersContainer.appendChild(card);
    });

    if (activeOrders.some((o) => o.status === "Pendente")) {
      this.startAlertSound();
    } else {
      this.stopAlertSound();
    }
  }

  formatDetails(custom) {
    if (!custom) return "";
    let parts = [];
    const sabor = custom.sabor || custom.flavour;
    if (sabor) {
      parts.push(
        `<span style="color: var(--amarelo); font-weight: bold;">SABOR: ${sabor.toUpperCase()}</span>`
      );
    }
    if (custom.calda) {
      parts.push(`Calda: ${custom.calda}`);
    }
    if (custom.burgers) {
      custom.burgers.forEach((b) => {
        let bParts = [];
        if (b.removed?.length) bParts.push(`SEM: ${b.removed.join(", ")}`);
        if (b.extras?.length)
          bParts.push(`ADIC: ${b.extras.map((e) => e.nome).join(", ")}`);
        parts.push(
          `- <b>${b.burgerName}</b> ${
            bParts.length
              ? `<br>&nbsp;&nbsp;${bParts.join("<br>&nbsp;&nbsp;")}`
              : ""
          }`
        );
      });
    } else {
      if (custom.removed?.length)
        parts.push(`SEM: ${custom.removed.join(", ")}`);
      if (custom.extras?.length)
        parts.push(`ADIC: ${custom.extras.map((e) => e.nome).join(", ")}`);
    }
    return parts.join("<br>");
  }

  formatPayments(pagamentos) {
    if (!pagamentos || pagamentos.length === 0) return "A pagar";
    return pagamentos.map((p) => p.method).join(" + ");
  }

  startAlertSound() {
    if (this.alertInterval) return;
    this.alertInterval = setInterval(() => {
      newOrderSound.play().catch(() => {});
    }, 3000);
  }

  stopAlertSound() {
    if (this.alertInterval) {
      clearInterval(this.alertInterval);
      this.alertInterval = null;
    }
  }

  acceptOrder(orderId) {
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === orderId);
    if (order) {
      if (order.status === "Pendente") order.status = "Preparo";
      else if (order.status === "Preparo") order.status = "Concluído";
      this.saveOrders(orders);
    }
  }

  deleteOrder(orderId) {
    if (confirm("Deseja realmente remover este pedido?")) {
      const orders = this.getOrders().filter((o) => o.id !== orderId);
      this.saveOrders(orders);
    }
  }

  toggleHistorySidebar() {
    this.historySidebar.classList.toggle("active");
    if (this.historySidebar.classList.contains("active")) this.renderHistory();
  }

  toggleSettingsSidebar() {
    this.settingsSidebar.classList.toggle("active");
  }

  renderHistory() {
    const orders = this.getOrders().filter((o) => o.status === "Concluído");
    this.historyContent.innerHTML = orders.length
      ? ""
      : "<p>Nenhum pedido concluído.</p>";
    orders.reverse().forEach((o) => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.innerHTML = `<div><strong>${o.nomeCliente}</strong><br><small>${
        o.dataHora
      }</small></div><div>R$ ${o.total.toFixed(2)}</div>`;
      this.historyContent.appendChild(div);
    });
  }

  openObservationModal(orderId) {
    this.currentOrderId = orderId;
    const order = this.getOrders().find((o) => o.id === orderId);
    if (!order) return;
    document.getElementById(
      "obsOrderInfo"
    ).textContent = `Pedido de: ${order.nomeCliente}`;
    document.getElementById("obsTextarea").value = order.observacao || "";
    document.getElementById("popupObservacao").style.display = "block";
    this.backdrop.style.display = "block";
  }

  saveObservation() {
    const obs = document.getElementById("obsTextarea").value;
    const orders = this.getOrders();
    const order = orders.find((o) => o.id === this.currentOrderId);
    if (order) {
      order.observacao = obs;
      this.saveOrders(orders);
    }
    this.closeModal("popupObservacao");
  }

  closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
    this.backdrop.style.display = "none";
    this.currentOrderId = null;
  }

  // ===============================================
  // GESTÃO DE DISPONIBILIDADE (ITENS E INSUMOS)
  // ===============================================
  // --- GESTÃO DE CARDÁPIO (PRODUTOS) ---
  openMenuManagementModal() {
    const modal = document.getElementById("menuManagementModal");
    const content = document.getElementById("menuManagementContent");
    const title = modal.querySelector("h3");
    if (title) title.textContent = "📋 Gestão de Cardápio";
    content.innerHTML =
      "<p style='color:white; padding:20px;'>Carregando produtos...</p>";
    modal.style.display = "block";
    this.backdrop.style.display = "block";
    fetch("cardapio.json")
      .then((res) => res.json())
      .then((data) => {
        content.innerHTML = "";
        Object.keys(data).forEach((categoria) => {
          const catTitle = document.createElement("h4");
          catTitle.style.color = "var(--amarelo)";
          catTitle.style.marginTop = "20px";
          catTitle.textContent = categoria;
          content.appendChild(catTitle);
          data[categoria].forEach((item) => {
            this.createManageItemRow(content, item.nome, false);
            if (item.opcoes && item.opcoes.length > 1) {
              item.opcoes.forEach((opt) => {
                this.createManageItemRow(content, opt, true, item.nome);
              });
            }
          });
        });
      });
  }
  createManageItemRow(container, name, isSubItem, parentName = null) {
    const displayName =
      parentName && isSubItem ? `${parentName} - ${name}` : name;
    const isUnavailable = this.isItemUnavailable(displayName);
    const itemDiv = document.createElement("div");
    itemDiv.style.display = "flex";
    itemDiv.style.justifyContent = "space-between";
    itemDiv.style.alignItems = "center";
    itemDiv.style.padding = "10px 12px";
    itemDiv.style.marginLeft = isSubItem ? "20px" : "0px";
    itemDiv.style.borderBottom = "1px solid #333";
    itemDiv.style.background = isSubItem
      ? "rgba(255,255,255,0.03)"
      : "transparent";
    itemDiv.innerHTML = `
      <span style="${
        isSubItem
          ? "font-size: 0.85em; color: #bbb;"
          : "font-weight: bold; color: white;"
      }">
        ${isSubItem ? "└ " : ""}${name}
      </span>
      <button class="action-btn ${isUnavailable ? "obs-btn" : "accept-btn"}"
        onclick="kdsManager.toggleItemAvailability('${displayName}')"
        style="padding: 5px 10px; font-size: 12px; min-width: 110px;">
        ${isUnavailable ? "INDISPONÍVEL" : "DISPONÍVEL"}
      </button>
    `;
    container.appendChild(itemDiv);
  }
  isItemUnavailable(itemName) {
    const unavailable = JSON.parse(
      localStorage.getItem("unavailable_items") || "[]"
    );
    return unavailable.includes(itemName);
  }
  toggleItemAvailability(itemName) {
    let unavailable = JSON.parse(
      localStorage.getItem("unavailable_items") || "[]"
    );

    const virouIndisponivel = !unavailable.includes(itemName);

    const updateList = (name, shouldAdd) => {
      if (shouldAdd) {
        if (!unavailable.includes(name)) unavailable.push(name);
      } else {
        unavailable = unavailable.filter((n) => n !== name);
      }
    };

    updateList(itemName, virouIndisponivel);

    // Lógica de Milk Shake (300 ml <-> 400 ml)
    if (itemName.toLowerCase().includes("milk shake")) {
      let itemCorrespondente = null;
      if (itemName.includes("300 ml")) {
        itemCorrespondente = itemName.replace("300 ml", "400 ml");
      } else if (itemName.includes("400 ml")) {
        itemCorrespondente = itemName.replace("400 ml", "300 ml");
      }

      if (itemCorrespondente) {
        updateList(itemCorrespondente, virouIndisponivel);
      }
    }

    localStorage.setItem("unavailable_items", JSON.stringify(unavailable));
    localStorage.setItem("unavailable_items_updated", Date.now());
    this.openMenuManagementModal();
  }
  // --- GESTÃO DE INSUMOS (INGREDIENTES/CALDAS) ---
  openIngredientManagementModal() {
    const modal = document.getElementById("menuManagementModal");
    const content = document.getElementById("menuManagementContent");
    const title = modal.querySelector("h3");
    if (title) title.textContent = "🍅 Gestão de Insumos";
    content.innerHTML =
      "<p style='color:white; padding:20px;'>Carregando insumos...</p>";
    modal.style.display = "block";
    this.backdrop.style.display = "block";
    fetch("cardapio.json")
      .then((res) => res.json())
      .then((data) => {
        const ingredientes = new Set();
        const extras = new Set();
        const caldas = new Set([
          "Chocolate",
          "Morango",
          "Caramelo",
          "Ovomaltine",
        ]);
        Object.values(data).forEach((category) => {
          category.forEach((item) => {
            // Coletar todos os ingredientes de todos os campos possíveis
            if (item.ingredientesPadrao) {
              item.ingredientesPadrao.forEach((i) => ingredientes.add(i));
            }
            if (item.simplesIngredients) {
              item.simplesIngredients.forEach((i) => ingredientes.add(i));
            }
            if (item.duploIngredients) {
              item.duploIngredients.forEach((i) => ingredientes.add(i));
            }
            if (item.ingredientesPorOpcao) {
              Object.values(item.ingredientesPorOpcao).forEach((arr) =>
                arr.forEach((i) => ingredientes.add(i))
              );
            }

            // Coletar todos os adicionais/extras de todos os campos possíveis
            if (item.adicionais) {
              item.adicionais.forEach((a) => extras.add(a.nome || a));
            }
            if (item.paidExtras) {
              item.paidExtras.forEach((a) => extras.add(a.nome || a));
            }
          });
        });
        content.innerHTML = `
        <div class="mgmt-section">
          <h4 style="color: var(--amarelo); margin-top:15px;">🥗 Ingredientes Padrão</h4>
          ${Array.from(ingredientes)
            .sort()
            .map((ing) => this.renderIngredientRow(ing, "Base"))
            .join("")}
         
          <h4 style="color: var(--amarelo); margin-top:25px;">💰 Adicionais Pagos</h4>
          ${Array.from(extras)
            .sort()
            .map((ext) => this.renderIngredientRow(ext, "Extra"))
            .join("")}
         
          <h4 style="color: var(--amarelo); margin-top:25px;">🍦 Caldas & Milkshake</h4>
          ${Array.from(caldas)
            .sort()
            .map((cal) => this.renderIngredientRow(cal, "Calda"))
            .join("")}
        </div>
      `;
      });
  }
  renderIngredientRow(name, type) {
    const isUnavailable = this.isIngredientUnavailable(name);
    return `
      <div style="display: center; justify-content: center; align-items: center; padding: 5px 10px; border-bottom: 1px solid #333;">
        <span style="color: white;"><small style="color: #888;">[${type}]</small> ${name}</span>
        <button class="action-btn ${isUnavailable ? "obs-btn" : "accept-btn"}"
                onclick="kdsManager.toggleIngredientAvailability('${name}')"
                style="padding: 5px 10px; font-size: 15px; min-width: 20px;">
          ${isUnavailable ? "INDISPONÍVEL" : "DISPONÍVEL"}
        </button>
      </div>
    `;
  }
  isIngredientUnavailable(name) {
    const unavailable = JSON.parse(
      localStorage.getItem("unavailable_ingredients") || "[]"
    );
    return unavailable.includes(name);
  }
  toggleIngredientAvailability(name) {
    let unavailable = JSON.parse(
      localStorage.getItem("unavailable_ingredients") || "[]"
    );
    if (unavailable.includes(name)) {
      unavailable = unavailable.filter((n) => n !== name);
    } else {
      unavailable.push(name);
    }
    localStorage.setItem(
      "unavailable_ingredients",
      JSON.stringify(unavailable)
    );
    localStorage.setItem("unavailable_ingredients_updated", Date.now());
    this.openIngredientManagementModal();
  }

  printOrder(orderId) {
    const order = this.getOrders().find((o) => o.id === orderId);
    if (!order) return;
    const win = window.open("", "PRINT", "height=600,width=400");
    win.document.write(`
      <html>
        <body style="font-family:monospace; width:280px; font-size: 12px; padding: 20px;">
          <center><h2>RIBBS ZN</h2><p>** ${order.tipoConsumo?.toUpperCase()} **</p><hr></center>
          <p>Cliente: ${order.nomeCliente}<br>Hora: ${order.dataHora}</p><hr>
          ${order.itens
            .map(
              (i) =>
                `<b>${i.quantity}x ${i.item}</b><br>${this.formatDetails(
                  i.custom
                ).replace(/<br>/g, ", ")}<br>`
            )
            .join("")}
          <hr>${order.observacao ? `<p>OBS: ${order.observacao}</p><hr>` : ""}
          <center><p>#Pedeoteu</p></center>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    win.document.close();
  }

  setupEventListeners() {
    const saveObsBtn = document.querySelector("#popupObservacao .accept-btn");
    if (saveObsBtn) saveObsBtn.onclick = () => this.saveObservation();
  }

  updateTimers() {}
}

const kdsManager = new KDSManager();

window.acceptOrder = (id) => kdsManager.acceptOrder(id);
window.openObservationModal = (id) => kdsManager.openObservationModal(id);
window.printOrder = (id) => kdsManager.printOrder(id);
window.deleteOrder = (id) => kdsManager.deleteOrder(id);
window.toggleHistorySidebar = () => kdsManager.toggleHistorySidebar();
window.toggleSettingsSidebar = () => kdsManager.toggleSettingsSidebar();
window.closeModal = (id) => kdsManager.closeModal(id);
window.closeMenuManagementModal = () => kdsManager.closeMenuManagementModal();
