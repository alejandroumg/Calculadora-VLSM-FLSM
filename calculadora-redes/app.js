function openTab(evt, tabName) {
  let i, tabcontent, tablinks;
  tabcontent = document.getElementsByClassName("tabcontent");
  for (i = 0; i < tabcontent.length; i++) {
    tabcontent[i].style.display = "none";
  }
  tablinks = document.getElementsByClassName("tablink");
  for (i = 0; i < tablinks.length; i++) {
    tablinks[i].classList.remove("active");
  }
  document.getElementById(tabName).style.display = "block";
  evt.currentTarget.classList.add("active");
}

// Convierte prefijo a máscara decimal
function prefixToMask(prefix) {
  let mask = [];
  let bits = "1".repeat(prefix).padEnd(32, "0");
  for (let i = 0; i < 32; i += 8) {
    mask.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return mask.join(".");
}

// Convierte dirección IP a número
function ipToInt(ip) {
  return ip.split(".").reduce((acc, oct) => (acc << 8) + parseInt(oct), 0);
}

// Convierte número a dirección IP
function intToIp(num) {
  return [24,16,8,0].map(shift => (num >> shift) & 255).join(".");
}

//  Calcular VLSM
function calculateVLSM() {
  let network = document.getElementById("network").value;
  let prefix = parseInt(document.getElementById("prefix").value);
  let hosts = document.getElementById("hosts").value.split(",").map(x => parseInt(x.trim())).sort((a,b)=>b-a);

  let baseIp = ipToInt(network);
  let results = [];

  hosts.forEach(h => {
    let needed = h + 2; 
    let bits = Math.ceil(Math.log2(needed));
    let newPrefix = 32 - bits;
    let blockSize = Math.pow(2, bits);
    let subnetMask = prefixToMask(newPrefix);

    let netAddr = baseIp;
    let firstHost = netAddr + 1;
    let lastHost = netAddr + blockSize - 2;
    let broadcast = netAddr + blockSize - 1;

    results.push({
      requested: h,
      assigned: blockSize - 2,
      network: intToIp(netAddr),
      mask: subnetMask,
      prefix: "/" + newPrefix,
      range: intToIp(firstHost) + " - " + intToIp(lastHost),
      broadcast: intToIp(broadcast)
    });

    baseIp += blockSize;
  });

  let resultHTML = "<table><tr><th>Host solicitados</th><th>Host asignados</th><th>Dirección de red</th><th>Máscara</th><th>Prefijo</th><th>Rango</th><th>Broadcast</th></tr>";
  results.forEach(r => {
    resultHTML += `<tr>
      <td>${r.requested}</td>
      <td>${r.assigned}</td>
      <td>${r.network}</td>
      <td>${r.mask}</td>
      <td>${r.prefix}</td>
      <td>${r.range}</td>
      <td>${r.broadcast}</td>
    </tr>`;
  });
  resultHTML += "</table>";

  document.getElementById("vlsmResult").innerHTML = resultHTML;
}



//  Calcular FLSM (entrada: número de subredes requeridas)
function calculateFLSM() {
  const network = document.getElementById("flsmNetwork").value.trim();
  const basePrefix = parseInt(document.getElementById("flsmPrefix").value, 10);
  // Número de subredes 
  const requestedSubnets = parseInt(document.getElementById("flsmHosts").value, 10);

  if (!network || isNaN(basePrefix) || isNaN(requestedSubnets) || requestedSubnets < 1) {
    document.getElementById("flsmResult").innerHTML = "<p>Completa todos los campos correctamente.</p>";
    return;
  }

  const baseIp = ipToInt(network);

  // Bits a pedir para cubrir al menos subnets requeridas
  const bitsBorrowed = Math.ceil(Math.log2(requestedSubnets));
  const newPrefix = basePrefix + bitsBorrowed;

  if (newPrefix > 30) {
    document.getElementById("flsmResult").innerHTML =
      "<p>No es posible crear tantas subredes dentro del prefijo base.</p>";
    return;
  }

  // Tamaño de cada subred y cuántas subredes caben (potencia de 2)
  const blockSize = Math.pow(2, 32 - newPrefix);        
  const availableSubnets = Math.pow(2, bitsBorrowed);    
  const mask = prefixToMask(newPrefix);
  const usableHosts = Math.max(0, blockSize - 2);

  //  Tabla en el orden enseñado en clase
  // Rango (desde-hasta) | Nueva máscara | Host asignados | Broadcast
  let html = "<table><tr><th>Rango (desde-hasta)</th><th>Nueva máscara</th><th>Host asignados</th><th>Broadcast</th></tr>";

  for (let i = 0; i < availableSubnets; i++) {
    const netAddr = baseIp + i * blockSize;
    const firstHost = netAddr + 1;
    const lastHost  = netAddr + blockSize - 2;
    const bcast     = netAddr + blockSize - 1;

    html += `<tr>
      <td>${intToIp(firstHost)} - ${intToIp(lastHost)}</td>
      <td>${mask}</td>
      <td>${usableHosts}</td>
      <td>${intToIp(bcast)}</td>
    </tr>`;
  }
  html += "</table>";

  document.getElementById("flsmResult").innerHTML = html;
}


function clearVLSM() {
  document.getElementById("vlsmForm").reset();
  document.getElementById("vlsmResult").innerHTML = "";
}

function clearFLSM() {
  document.getElementById("flsmForm").reset();
  document.getElementById("flsmResult").innerHTML = "";
}
async function downloadPDF(type) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // ---------------- VLSM ----------------
  if (type === "vlsm") {
    const network = document.getElementById("network").value;
    const prefix = parseInt(document.getElementById("prefix").value, 10);
    const hostsInput = document.getElementById("hosts").value;
    const hosts = hostsInput.split(",").map(x => parseInt(x.trim(),10)).sort((a,b)=>b-a);

    doc.setFontSize(14);
    doc.text("Reporte Detallado de Cálculo VLSM", 10, 10);

    doc.setFontSize(11);
    doc.text(`Red base: ${network}/${prefix}`, 10, 20);
    doc.text(`Hosts requeridos: ${hosts.join(", ")}`, 10, 30);
    
    let y = 45;

    hosts.forEach((h, idx) => {
      const needed = h + 2;                          
      const bits = Math.ceil(Math.log2(needed));     
      const newPrefix = 32 - bits;
      const blockSize = 2 ** bits;
      const mask = prefixToMask(newPrefix);

      const maskBinary = mask.split(".").map(oct =>
        parseInt(oct).toString(2).padStart(8, "0")
      ).join(".");

      const maskOctets = mask.split(".").map(x => parseInt(x));
      const affectedOctet = maskOctets.find(x => x !== 255 && x !== 0);
      const salto = 256 - affectedOctet;

      doc.setFontSize(12);
      doc.text(`Subred ${idx+1}:`, 10, y); y+=8;
      doc.setFontSize(11);
      doc.text(`1. Hosts solicitados: ${h}`, 10, y); y+=8;
      doc.text(`2. Máscara actual /${prefix}`, 10, y); y+=8;
      doc.text(`   Binario: ${prefixToMask(prefix).split(".").map(o=>parseInt(o).toString(2).padStart(8,"0")).join(".")}`, 10, y); y+=8;
      doc.text(`3. Fórmula 2^M - 2 con M=${bits} → ${blockSize-2} hosts`, 10, y); y+=8;
      doc.text(`4. Nueva máscara: ${mask} (${maskBinary}) /${newPrefix}`, 10, y); y+=8;
      doc.text(`5. Salto: 256 - ${affectedOctet} = ${salto}`, 10, y); y+=8;
      doc.text(`6. Direccionamiento: (ver tabla resumen abajo)`, 10, y); y+=8;
      doc.text(`7. IPs para enlaces: reservar según topología.`, 10, y); y+=12;

      if (y > 270) { doc.addPage(); y = 20; }
    });
  } 

  // ---------------- FLSM ----------------
  if (type === "flsm") {
    const network = document.getElementById("flsmNetwork").value.trim();
    const basePrefix = parseInt(document.getElementById("flsmPrefix").value, 10);
    const requestedSubnets = parseInt(document.getElementById("flsmHosts").value, 10);

    doc.setFontSize(14);
    doc.text("Reporte Detallado de Cálculo FLSM", 10, 10);

    doc.setFontSize(11);
    doc.text(`Red base: ${network}/${basePrefix}`, 10, 20);
    doc.text(`Número de subredes requeridas: ${requestedSubnets}`, 10, 30);

    const bitsBorrowed = Math.ceil(Math.log2(requestedSubnets));
    const newPrefix = basePrefix + bitsBorrowed;
    const blockSize = 2 ** (32 - newPrefix);
    const mask = prefixToMask(newPrefix);
    const usableHosts = blockSize - 2;

    let y = 45;
    doc.text("Paso a paso:", 10, y); y+=10;
    doc.text(`1. Red base: ${network}/${basePrefix}`, 10, y); y+=8;
    doc.text(`2. Subredes solicitadas: ${requestedSubnets}`, 10, y); y+=8;
    doc.text(`3. Bits prestados: ${bitsBorrowed}`, 10, y); y+=8;
    doc.text(`4. Nuevo prefijo: /${newPrefix}`, 10, y); y+=8;
    doc.text(`5. Nueva máscara: ${mask}`, 10, y); y+=8;
    doc.text(`6. Tamaño de bloque: ${blockSize} direcciones → ${usableHosts} hosts útiles`, 10, y); y+=8;
    doc.text(`7. Direccionamiento: ver tabla resumen abajo.`, 10, y); y+=8;
  }

  // ---------------- Tabla con autoTable ----------------
  const tableSelector = type === "vlsm" ? "#vlsmResult table" : "#flsmResult table";
  const tableElement = document.querySelector(tableSelector);
  if (tableElement) {
    doc.addPage();
    doc.setFontSize(13);
    doc.text("Tabla generada", 14, 20);
    doc.autoTable({ html: tableElement, startY: 30 });
  }

  doc.save(`${type}_calculo.pdf`);
}