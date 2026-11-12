//Elaborado para el lab de programación web
//segundo intento de hacer el javascript
/*VARIABLES GLOBALES*/
    //ENDPOINTS
const API_BUSQUEDA = 'https://openlibrary.org/search.json';
const API_OBRAS = 'https://openlibrary.org/works/';

    //Constantes de control
const TAMANO_PAGINA = 10;
const TIEMPO_LIMITE_MS = 12000;

const CLAVE_ALMACENAMIENTO = 'biblioteca-guardada-v2';

    //Campos que se le pide a la API
const CAMPOS = 'key,title,author_name,first_publish_year,language';

    //Idiomas, pasarlos de clave a nombre
const IDIOMAS = {
    spa: 'Español', eng: 'Inglés', fre: 'Francés', ger: 'Alemán', ita: 'Italiano',
    por: 'Portugués', cat: 'Catalán', lat: 'Latín', rus: 'Ruso', chi: 'Chino',
    jpn: 'Japonés', kor: 'Coreano', ara: 'Árabe', dut: 'Neerlandés', pol: 'Polaco',
    swe: 'Sueco', heb: 'Hebreo', gre: 'Griego', tur: 'Turco', hin: 'Hindi',
};

const nombreIdioma = (codigo) => IDIOMAS[codigo] ?? String(codigo).toUpperCase();

    //Atajos para el DOM
const atajo = (id) => document.getElementById(id);
  
const interfaz = {    
    formulario: atajo('search-form'),
    campoBusqueda: atajo('q'),
    idioma: atajo('lang'),
    anioDesde: atajo('year-from'),
    anioHasta: atajo('year-to'),
    botonBuscar: atajo('search-btn'),
    errorFormulario: atajo('form-error'),

    seccionResultados: atajo('results-section'),
    estadoResultados: atajo('results-status'),
    envolturaResultados: atajo('results-wrap'),
    cuerpoResultados: atajo('results-body'),
    paginacion: atajo('pagination'),
    infoPagina: atajo('page-info'),
    botonAnterior: atajo('prev-btn'),
    botonSiguiente: atajo('next-btn'),

    contadorGuardados: atajo('saved-count'),
    vacioGuardados: atajo('saved-empty'),
    envolturaGuardados: atajo('saved-wrap'),
    cuerpoGuardados: atajo('saved-body'),

    dialogo: atajo('confirm-dialog'),
    cuerpoDialogo: atajo('dialog-body'),
    aviso: atajo('notice'),
};

    //Estados posibles de la app
const estado = {
    busqueda: null,         
    guardados: cargarGuardados(), 
    seleccionando: false, 
    filtros: {},
    orden: null,            
};

/** Crea un elemento del DOM. Siempre usa textContent, nunca innerHTML. */
function crearElemento(etiqueta, atributos = {}, ...hijos) {

    const nodo = document.createElement(etiqueta);
    for (const [nombre, valor] of Object.entries(atributos)) {
        if (valor === null || valor === undefined || valor === false) continue;
        if (nombre === 'class') nodo.className = valor;
        else if (nombre === 'texto') nodo.textContent = valor;
        else if (nombre.startsWith('on')) nodo.addEventListener(nombre.slice(2), valor);
        else nodo.setAttribute(nombre, valor === true ? '' : valor);
    }
    nodo.append(...hijos.flat().filter((h) => h !== null && h !== undefined && h !== false));
    return nodo;

}

function etiquetaIdiomas(codigos) {

    if (!codigos || codigos.length === 0) return 'No indicado';
    const nombres = codigos.map(nombreIdioma);
    return nombres.length > 3
        ? `${nombres.slice(0, 3).join(', ')} +${nombres.length - 3}`
        : nombres.join(', ');

}

function llenarSelectIdiomas(select, primeraEtiqueta) {

    select.replaceChildren(crearElemento('option', { value: '', texto: primeraEtiqueta }));
    Object.entries(IDIOMAS)
        .sort((a, b) => a[1].localeCompare(b[1], 'es'))
        .forEach(([codigo, nombre]) => select.append(crearElemento('option', { value: codigo, texto: nombre })));
    
}

/** Devuelve null (vacío), un entero válido, o NaN (inválido). */
function interpretarAnio(valor) {

    const texto = String(valor).trim();
        if (texto === '') return null;
        const numero = Number(texto);
        return Number.isInteger(numero) && numero >= 0 && numero <= 9999 ? numero : NaN;

}

let temporizadorAviso;
function avisar(mensaje, tipo = 'info') {
    
    interfaz.aviso.className = `notice ${tipo}`;
    interfaz.aviso.textContent = mensaje;
    interfaz.aviso.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { interfaz.aviso.hidden = true; }, 6000);

}

/*Funciones para guardar y cargar */
function cargarGuardados() {
    
    try {
        const datos = JSON.parse(localStorage.getItem(CLAVE_ALMACENAMIENTO));
        return Array.isArray(datos) ? datos : [];
    }catch {
        return [];
    }

}

function guardarEnAlmacenamiento() {
    
    try {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(estado.guardados));
    }catch {
        avisar('No se pudo guardar tu tabla en este navegador. Se perderá al cerrar la página.', 'warn');
    }

}
/*Funciones en caso de error */
    //Error propio, para distinguir los fallos de la API de cualquier otro error
class ErrorApi extends Error {}

    //Errores típicos de las APIS
function mensajePorEstado(codigo) {
    
    if (codigo === 400) return 'Búsqueda inválida.';
    if (codigo === 404) return 'No se encontró.';
    if (codigo === 429) return 'Límite de consultas sobrepasado, intenta luego.';
    if (codigo >= 500) return 'No se pudo hacer contacto con Open Library, por favor intenta luego.';
    
    return `ERROR INESPERADO (código ${codigo}).`;
}

async function obtenerJSON(url) {
    try{
        //AbortSignal.timeout cancela la petición si pasa el tiempo límite
        const respuesta = await fetch(url,{
            signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
            headers: { Accept: 'application/json' },
        });

        if (!respuesta.ok) throw new ErrorApi(mensajePorEstado(respuesta.status));
        try{
            return await respuesta.json();
        }catch{
            throw new ErrorApi('La respuesta de Open Library no tiene un formato válido.');
        }
    }catch (error){
        if (error instanceof ErrorApi) throw error;
        if (error.name === 'TimeoutError') throw new ErrorApi('Open Library tardó demasiado en responder. Inténtalo de nuevo.');
        throw new ErrorApi('No se pudo conectar con Open Library. Revisa tu conexión a internet.');
    }
}

const textoDeError = (error) =>
    error instanceof ErrorApi ? error.message : 'Ocurrió un error inesperado. Inténtalo de nuevo.';

/*Evitar caracteres especiales */
function limpiarTexto(crudo) {
    let texto = crudo.replace(/[()[\]{}:^~\\]/g, ' ').replace(/\s+/g, ' ').trim();
    if ((texto.match(/"/g) || []).length % 2 === 1) texto = texto.replace(/"/g, '');
    return texto;
}

function construirConsulta({ texto, idioma, desde, hasta }) {
    const partes = [texto];
    if (idioma) partes.push(`language:${idioma}`);
    if (desde !== null || hasta !== null) {
        partes.push(`first_publish_year:[${desde ?? '*'} TO ${hasta ?? '*'}]`);
    }
    return partes.length > 1 ? partes.map((p, i) => (i === 0 ? `(${p})` : p)).join(' AND ') : texto;
}

function mostrarErrorFormulario(mensaje){

    interfaz.errorFormulario.textContent = mensaje;
    interfaz.errorFormulario.hidden = !mensaje;

}

/*Funciones de búsqueda */
async function iniciarBusqueda(){
    mostrarErrorFormulario('');
    const texto = limpiarTexto(interfaz.campoBusqueda.value);
    const desde = interpretarAnio(interfaz.anioDesde.value);
    const hasta = interpretarAnio(interfaz.anioHasta.value);

    if (!texto) return mostrarErrorFormulario('Escribe un título, autor o tema para buscar.');
    if (Number.isNaN(desde) || Number.isNaN(hasta)){
        return mostrarErrorFormulario('Los años deben ser números enteros entre 0 y 9999.');
    }
    if (desde !== null && hasta !== null && desde > hasta){
        return mostrarErrorFormulario('El año inicial no puede ser mayor que el año final.');
    }

    estado.busqueda = { texto, idioma: interfaz.idioma.value, desde, hasta, pagina: 1, total: 0, resultados: [] };
    await cargarPagina(1);
}

async function cargarPagina(pagina){
    const busqueda = estado.busqueda;
    if (!busqueda) return;

    interfaz.seccionResultados.hidden = false;
    interfaz.envolturaResultados.hidden = true;
    interfaz.paginacion.hidden = true;
    fijarEstado('loading', 'Buscando libros…');
    interfaz.botonBuscar.disabled = true;

    try {
        const parametros = new URLSearchParams({
        q: construirConsulta(busqueda),
        fields: CAMPOS,
        limit: TAMANO_PAGINA,
        page: pagina,
        });
        const datos = await obtenerJSON(`${API_BUSQUEDA}?${parametros}`);

        const documentos = Array.isArray(datos.docs) ? datos.docs : [];
        busqueda.pagina = pagina;
        busqueda.resultados = documentos;
        busqueda.total = Number(datos.numFound ?? datos.num_found ?? documentos.length);
        mostrarResultados();
    }catch (error){
        fijarEstado('error', textoDeError(error), () => cargarPagina(pagina));
    } finally{
        interfaz.botonBuscar.disabled = false;
    }
}

function aLibro(documento, idioma) {
    const autores = Array.isArray(documento.author_name) ? documento.author_name : [];
    return {
        clave: String(documento.key ?? '').replace('/works/', ''),
        titulo: documento.title ?? 'Sin título',
        autor: autores[0] ?? 'Autor desconocido',
        masAutores: Math.max(autores.length - 1, 0),
        anio: documento.first_publish_year ?? null,
        idiomas: idioma ? [idioma] : (Array.isArray(documento.language) ? documento.language : []),
        descripcion: null,
    };
}

/* La descripción puede ser texto o un objeto { type, value }. */
function interpretarDescripcion(crudo) {
    const texto = typeof crudo === 'string' ? crudo : crudo?.value;
    if (typeof texto !== 'string') return null;
    const limpio = texto.split(/\r?\n-{5,}/)[0].trim();
    return limpio ? limpio.slice(0, 4000) : null;
}

/*IMPRIMIR RESULTADOS */
function fijarEstado(tipo, mensaje, reintentar) {
    interfaz.estadoResultados.replaceChildren();
    interfaz.estadoResultados.hidden = !tipo;
    if (!tipo) return;
    interfaz.estadoResultados.className = `status ${tipo}`;
    // append(null) escribiría la palabra "null" en la página, por eso se descartan los valores vacíos
    interfaz.estadoResultados.append(...[
        tipo === 'loading' ? crearElemento('div', { class: 'spinner', 'aria-hidden': 'true' }) : null,
        crearElemento('span', { texto: mensaje }),
        reintentar
        ? crearElemento('button', { type: 'button', class: 'btn small', onclick: reintentar, texto: 'Reintentar' })
        : null,
    ].filter(Boolean));
}

function mostrarResultados() {
  const { resultados, total, pagina, idioma } = estado.busqueda;

    if (resultados.length === 0) {
        interfaz.envolturaResultados.hidden = true;
        interfaz.paginacion.hidden = true;
            fijarEstado('empty',
            'No se encontraron resultados.');
    return;
    }

    fijarEstado(null);
    interfaz.cuerpoResultados.replaceChildren(...resultados.map((documento) => filaResultado(documento, idioma)));
    interfaz.envolturaResultados.hidden = false;

    const paginas = Math.max(Math.ceil(total / TAMANO_PAGINA), 1);
    const primero = (pagina - 1) * TAMANO_PAGINA + 1;
    const ultimo = primero + resultados.length - 1;
    interfaz.infoPagina.textContent =
        `Página ${pagina} de ${paginas} · ${primero}–${ultimo} de ${total.toLocaleString('es-MX')}`;
    interfaz.botonAnterior.disabled = pagina <= 1;
    interfaz.botonSiguiente.disabled = pagina >= paginas;
    interfaz.paginacion.hidden = total <= TAMANO_PAGINA;
}

function filaResultado(documento, idioma) {
    const libro = aLibro(documento, idioma);
    const activar = () => seleccionarLibro(documento, idioma);

    return crearElemento('tr', {
        class: 'clickable',
        tabindex: '0',
        title: 'Haz clic para guardar este libro',
        onclick: activar,
        onkeydown: (evento) => {
            if (evento.key === 'Enter' || evento.key === ' ') { evento.preventDefault(); activar(); }
            },
    },
        crearElemento('td', { class: 'title', texto: libro.titulo }),
        crearElemento('td', {}, celdaAutor(libro)),
        crearElemento('td', { texto: libro.anio ?? 'No indicada' }),
        crearElemento('td', { texto: etiquetaIdiomas(libro.idiomas) }),
    );
}

function celdaAutor(libro) {
    return [
        crearElemento('div', { texto: libro.autor }),
        libro.masAutores ? crearElemento('div', { class: 'muted', texto: `y ${libro.masAutores} más` }) : null,
    ];
}

/*Confirmar si se quiere guardar resultado */
function confirmarGuardado(libro) {
    const detalles = [
        libro.anio ? `Primera publicación: ${libro.anio}` : 'Año de publicación no indicado',
        `Idioma: ${etiquetaIdiomas(libro.idiomas)}`,
    ];

    interfaz.cuerpoDialogo.replaceChildren(
        crearElemento('div', {},
        crearElemento('div', { class: 'title', texto: libro.titulo }),
        crearElemento('div', { texto: libro.masAutores ? `${libro.autor} y ${libro.masAutores} más` : libro.autor }),
        ...detalles.map((linea) => crearElemento('div', { class: 'muted', texto: linea })),
        ),
    );

      return new Promise((resolver) => {
        interfaz.dialogo.returnValue = '';
        interfaz.dialogo.addEventListener('close', () => resolver(interfaz.dialogo.returnValue === 'save'), { once: true });
        interfaz.dialogo.showModal();
    });
}

async function seleccionarLibro(documento, idioma) {
    if (estado.seleccionando) return;
    const libro = aLibro(documento, idioma);

    if (!libro.clave) return avisar('Este resultado no tiene un identificador válido.', 'error');
    if (estado.guardados.some((l) => l.clave === libro.clave)) {
        return avisar(`${libro.titulo} ya está en tu tabla.`, 'info');
    }

    estado.seleccionando = true;
    const aceptado = await confirmarGuardado(libro);
    if (!aceptado) {
        estado.seleccionando = false; // cancelado: los resultados se quedan como estaban
        return;
    }

    interfaz.envolturaResultados.classList.add('busy');
    fijarEstado('loading', `Guardando ${libro.titulo} y buscando su descripción...`);

    let fallaDescripcion = false;
    try{
    const obra = await obtenerJSON(`${API_OBRAS}${encodeURIComponent(libro.clave)}.json`);
    libro.descripcion = interpretarDescripcion(obra.description);
    } catch {
        fallaDescripcion = true; // guardamos el libro igualmente, sin descripción
    }

    estado.guardados.unshift(libro);
    guardarEnAlmacenamiento();

    // Si los filtros activos esconderían el libro recién guardado, se quitan
    const filtrosQuitados = !cumpleFiltros(libro);
    if (filtrosQuitados) estado.filtros = {};

    // Se descartan los demás resultados
    estado.busqueda = null;
    interfaz.envolturaResultados.classList.remove('busy');
    interfaz.seccionResultados.hidden = true;
    interfaz.cuerpoResultados.replaceChildren();
    interfaz.campoBusqueda.value = '';
    estado.seleccionando = false;

    mostrarGuardados(libro.clave);
    atajo('library-title').scrollIntoView({ behavior: 'smooth', block: 'start' });

    const extra = [
        fallaDescripcion ? 'No se pudo obtener su descripción.' : '',
        filtrosQuitados ? 'Se quitaron los filtros para mostrarlo.' : '',
    ].filter(Boolean).join(' ');
    avisar(`${libro.titulo} se guardó en tu tabla. ${extra}`.trim(), fallaDescripcion ? 'warn' : 'success');
}


/*Filtrar tabla */

const ANIO_NO_INDICADO = 'No indicada';

// Las claves coinciden con el atributo data-col de cada encabezado en index.html
const COLUMNAS = {
    autor: {
        etiqueta: 'Autor',
        valores: (l) => [l.autor],
        claveOrden: (l) => l.autor,
    },
    titulo: {
        etiqueta: 'Libro',
        valores: (l) => [l.titulo],
        claveOrden: (l) => l.titulo,
    },
    anio: {
        etiqueta: 'Publicación',
        numerica: true,
        valores: (l) => [l.anio === null ? ANIO_NO_INDICADO : String(l.anio)],
        claveOrden: (l) => l.anio,
    },
    idioma: {
        etiqueta: 'Idioma',
        valores: (l) => (l.idiomas.length ? l.idiomas.map(nombreIdioma) : ['No indicado']),
        claveOrden: (l) => (l.idiomas.length ? nombreIdioma(l.idiomas[0]) : null),
    },
    descripcion: {
        etiqueta: 'Descripción',
        ordenable: false,
        valores: (l) => [l.descripcion ? 'Con descripción' : 'Sin descripción'],
    },
};

const cantidadFiltros = () => Object.keys(estado.filtros).length;

function cumpleFiltros(libro) {
    return Object.entries(estado.filtros).every(([columna, permitidos]) =>
        COLUMNAS[columna].valores(libro).some((v) => permitidos.has(v)));
}

function ordenarLibros(lista) {
    if (!estado.orden) return lista;
    const { claveOrden, numerica } = COLUMNAS[estado.orden.columna];
    const sentido = estado.orden.direccion === 'asc' ? 1 : -1;
    return [...lista].sort((a, b) => {
        const claveA = claveOrden(a);
        const claveB = claveOrden(b);
        if (claveA === null && claveB === null) return 0;
        if (claveA === null) return 1;   // los vacíos siempre al final
        if (claveB === null) return -1;
        const comparacion = numerica ? claveA - claveB : String(claveA).localeCompare(String(claveB), 'es');
        return comparacion * sentido;
    });
}

function valoresUnicos(columna) {
    const { valores, numerica } = COLUMNAS[columna];
    const unicos = [...new Set(estado.guardados.flatMap(valores))];
    const aNumero = (v) => (/^\d+$/.test(v) ? Number(v) : Infinity);
    return unicos.sort((a, b) => {
        if (numerica) {
            const diferencia = aNumero(a) - aNumero(b);
            return Number.isNaN(diferencia) ? 0 : diferencia; // Infinity - Infinity = NaN
        }
        return a.localeCompare(b, 'es');
    });
}

/*Encabezados: botón e indicador de orden*/
function prepararEncabezados() {
    document.querySelectorAll('#saved-wrap th[data-col]').forEach((encabezado) => {
        const columna = encabezado.dataset.col;
        const etiqueta = COLUMNAS[columna].etiqueta;
        const boton = crearElemento('button', {
            type: 'button',
            class: 'th-filter',
            'aria-haspopup': 'dialog',
            'aria-expanded': 'false',
            'aria-label': `Filtrar y ordenar: ${etiqueta}`,
            texto: '▾',
            onclick: () => abrirMenu(columna, boton),
        });
        encabezado.replaceChildren(crearElemento('div', { class: 'th-inner' },
            crearElemento('span', { texto: etiqueta }),
            crearElemento('span', { class: 'sort-ind', 'aria-hidden': 'true' }),
            boton,
        ));
    });
}

function actualizarEncabezados() {
    document.querySelectorAll('#saved-wrap th[data-col]').forEach((encabezado) => {
        const columna = encabezado.dataset.col;
        const boton = encabezado.querySelector('.th-filter');
        const activo = Boolean(estado.filtros[columna]);
        boton.classList.toggle('active', activo);
        boton.setAttribute('aria-label',
        `Filtrar y ordenar: ${COLUMNAS[columna].etiqueta}${activo ? ' (filtro activo)' : ''}`);

        const ordenado = estado.orden?.columna === columna ? estado.orden.direccion : null;
        encabezado.querySelector('.sort-ind').textContent = ordenado === 'asc' ? '↑' : ordenado === 'desc' ? '↓' : '';
        encabezado.setAttribute('aria-sort',
        ordenado === 'asc' ? 'ascending' : ordenado === 'desc' ? 'descending' : 'none');
    });
}

/* Menú del filtro */
let menuAbierto = null; // { columna, boton, nodo }

function cerrarMenu(devolverFoco = true) {
    if (!menuAbierto) return;
    const { nodo, boton } = menuAbierto;
    nodo.remove();
    boton.setAttribute('aria-expanded', 'false');
    menuAbierto = null;
    if (devolverFoco) boton.focus();
}

function fijarOrden(columna, direccion) {
    const igual = estado.orden?.columna === columna && estado.orden.direccion === direccion;
    estado.orden = igual ? null : { columna, direccion };
    cerrarMenu();
    mostrarGuardados();
}

function abrirMenu(columna, boton) {
    if (menuAbierto?.columna === columna) return cerrarMenu();
    cerrarMenu(false);

    const definicion = COLUMNAS[columna];
    const todos = valoresUnicos(columna);
    const actual = estado.filtros[columna];
    const borrador = new Set(actual ? todos.filter((v) => actual.has(v)) : todos);
    const casillas = new Map(); // valor → casilla (para sincronizar)

    const nodo = crearElemento('div', {
        class: 'filter-menu',
        role: 'dialog',
        'aria-label': `Filtro de ${definicion.etiqueta}`,
    });

    /* Ordenar */
    if (definicion.ordenable !== false) {
        const etiquetas = definicion.numerica
        ? ['Ordenar de menor a mayor', 'Ordenar de mayor a menor']
        : ['Ordenar de A a Z', 'Ordenar de Z a A'];
        ['asc', 'desc'].forEach((direccion, i) => {
            const activo = estado.orden?.columna === columna && estado.orden.direccion === direccion;
            nodo.append(crearElemento('button', {
                type: 'button',
                class: 'menu-item',
                'aria-pressed': String(activo),
                onclick: () => fijarOrden(columna, direccion),
                texto: `${activo ? '✓ ' : ''}${etiquetas[i]}`,
            }));
        });
    nodo.append(crearElemento('hr', { class: 'menu-sep' }));
  }

    /* Borrar filtro de esta columna */
    nodo.append(crearElemento('button', {
        type: 'button',
        class: 'menu-item',
        disabled: !actual,
        onclick: () => {
            delete estado.filtros[columna];
            cerrarMenu();
            mostrarGuardados();
        },
        texto: `Borrar filtro de ${definicion.etiqueta}`,
    }));

  /* Lista con casillas */
    const casillaMaestra = crearElemento('input', { type: 'checkbox' });
    const elementos = crearElemento('div');
    const caja = crearElemento('div', { class: 'menu-box' },
        crearElemento('label', { class: 'menu-check all' }, casillaMaestra, crearElemento('span', { texto: '(Seleccionar todo)' })),
        elementos,
    );
    nodo.append(caja);

    const aceptar = crearElemento('button', { type: 'button', class: 'btn primary small', texto: 'Aceptar' });
    const cancelar = crearElemento('button', {
        type: 'button',
        class: 'btn small',
        onclick: () => cerrarMenu(),
        texto: 'Cancelar',
    });
    nodo.append(crearElemento('div', { class: 'menu-actions' }, cancelar, aceptar));

    function sincronizarMaestra() {
        casillaMaestra.checked = borrador.size === todos.length;
        casillaMaestra.indeterminate = borrador.size > 0 && borrador.size < todos.length;
        aceptar.disabled = borrador.size === 0;
    }

    elementos.replaceChildren(...todos.map((valor) => {
        const casilla = crearElemento('input', { type: 'checkbox' });
        casilla.checked = borrador.has(valor);
        casilla.addEventListener('change', () => {
            if (casilla.checked) borrador.add(valor); else borrador.delete(valor);
            sincronizarMaestra();
        });
        casillas.set(valor, casilla);
        return crearElemento('label', { class: 'menu-check' }, casilla, crearElemento('span', { texto: valor }));
    }));
    sincronizarMaestra();

    casillaMaestra.addEventListener('change', () => {
        todos.forEach((v) => (casillaMaestra.checked ? borrador.add(v) : borrador.delete(v)));
        casillas.forEach((casilla, valor) => { casilla.checked = borrador.has(valor); });
        sincronizarMaestra();
    });

    aceptar.addEventListener('click', () => {
        const todoMarcado = todos.every((v) => borrador.has(v));
        if (todoMarcado) delete estado.filtros[columna];
        else estado.filtros[columna] = new Set(borrador);
        cerrarMenu();
        mostrarGuardados();
    });

    /* Posición bajo el botón, sin salirse de la pantalla */
    document.body.append(nodo);
    const rectangulo = boton.getBoundingClientRect();
    const izquierdaMaxima = window.scrollX + document.documentElement.clientWidth - nodo.offsetWidth - 8;
    nodo.style.left = `${Math.max(8, Math.min(rectangulo.left + window.scrollX, izquierdaMaxima))}px`;
    nodo.style.top = `${rectangulo.bottom + window.scrollY + 4}px`;

    boton.setAttribute('aria-expanded', 'true');
    menuAbierto = { columna, boton, nodo };
    casillaMaestra.focus();
}

/*Eliminar elementos de la tabla */
function mostrarGuardados(claveResaltada) {
    cerrarMenu(false);
    actualizarEncabezados();

    const total = estado.guardados.length;
    const visibles = ordenarLibros(estado.guardados.filter(cumpleFiltros));
    const hayFiltros = cantidadFiltros() > 0;

    interfaz.envolturaGuardados.hidden = total === 0;
    interfaz.vacioGuardados.hidden = total !== 0;

    if(total === 0) {
        interfaz.vacioGuardados.textContent = 'Aún no has guardado ningún libro. Busca uno arriba y guárdalo.';
        interfaz.contadorGuardados.textContent = '';
        interfaz.cuerpoGuardados.replaceChildren();
        return;
    }

    if(visibles.length === 0) {
        interfaz.cuerpoGuardados.replaceChildren(crearElemento('tr', {},
        crearElemento('td', {
            colspan: '6',
            class: 'muted empty-cell',
            texto: 'Ningún libro coincide con los filtros aplicados.',
        })));
    } else {
        interfaz.cuerpoGuardados.replaceChildren(
        ...visibles.map((l) => filaGuardada(l, l.clave === claveResaltada)));
        } 

    interfaz.contadorGuardados.textContent =
        `Mostrando ${visibles.length} de ${total} libro${total === 1 ? '' : 's'}${hayFiltros ? ' (filtrado)' : ''}.`;
}

    function filaGuardada(libro, esNuevo) {
        return crearElemento('tr', { class: esNuevo ? 'just-added' : null },
            crearElemento('td', {}, celdaAutor(libro)),
            crearElemento('td', { class: 'title', texto: libro.titulo }),
            crearElemento('td', { texto: libro.anio ?? ANIO_NO_INDICADO }),
            crearElemento('td', { texto: etiquetaIdiomas(libro.idiomas) }),
            crearElemento('td', {}, celdaDescripcion(libro.descripcion)),
            crearElemento('td', {}, crearElemento('button', {
                type: 'button',
                class: 'btn danger small',
                'aria-label': `Eliminar ${libro.titulo}`,
                onclick: () => eliminarLibro(libro.clave),
                texto: 'Eliminar',
                }),
            ),
        );
    }

function celdaDescripcion(texto) {
    if (!texto) return crearElemento('span', { class: 'muted', texto: 'Sin descripción disponible.' });

    const contenedor = crearElemento('div', { class: 'desc', texto });
    if (texto.length <= 220) return contenedor;

    contenedor.classList.add('clamped');
    const alternar = crearElemento('button', {
        type: 'button',
        class: 'link-btn',
        'aria-expanded': 'false',
        texto: 'Ver más',
        });
    alternar.addEventListener('click', () => {
        const expandido = contenedor.classList.toggle('clamped') === false;
        alternar.textContent = expandido ? 'Ver menos' : 'Ver más';
        alternar.setAttribute('aria-expanded', String(expandido));
    });
    return crearElemento('div', {}, contenedor, alternar);
}

function eliminarLibro(clave) {
    const libro = estado.guardados.find((l) => l.clave === clave);
    estado.guardados = estado.guardados.filter((l) => l.clave !== clave);
    guardarEnAlmacenamiento();
    mostrarGuardados();
    if (libro) avisar(`${libro.titulo} se eliminó de tu tabla.`, 'info');
}

/*INICIAR PROGRAMA */
interfaz.formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    iniciarBusqueda();
});

interfaz.botonAnterior.addEventListener('click', () => estado.busqueda && cargarPagina(estado.busqueda.pagina - 1));
interfaz.botonSiguiente.addEventListener('click', () => estado.busqueda && cargarPagina(estado.busqueda.pagina + 1));

// Cerrar el diálogo al hacer clic en el fondo oscuro
interfaz.dialogo.addEventListener('click', (evento) => {
    if (evento.target === interfaz.dialogo) interfaz.dialogo.close('');
    });

// Cerrar el menú de filtro al hacer clic fuera, con Escape, al redimensionar o al desplazar la tabla
document.addEventListener('pointerdown', (evento) => {
    if (menuAbierto && !menuAbierto.nodo.contains(evento.target) && !evento.target.closest('.th-filter')) {
        cerrarMenu(false);
    }
});

document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && menuAbierto) cerrarMenu();
});

window.addEventListener('resize', () => cerrarMenu(false));

interfaz.envolturaGuardados.addEventListener('scroll', () => cerrarMenu(false));

llenarSelectIdiomas(interfaz.idioma, 'Cualquiera');
prepararEncabezados();
mostrarGuardados();
