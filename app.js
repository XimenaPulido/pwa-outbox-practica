if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.tipo === 'OUTBOX_SINCRONIZADO') {
        console.log('[UI] Confirmación recibida del Service Worker. Actualizando bandeja...');
        renderizarColaOutbox();
      }
    });
  }
  

  function procesarEnvioReporte(datosFormulario){
    const endpoint = 'https://jsonplaceholder.typicode.com/posts';
  
    return fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosFormulario)
    })
      .then((respuesta) => {
        if (!respuesta.ok) {
          throw new Error('Error HTTP del servidor');
        }
        return respuesta.json();
      })
      .then(() => {
        // Envío exitoso: guardar como sincronizado
        return guardarRegistro({
          ...datosFormulario,
          estado: 'sincronizado',
          fechaCreacion: Date.now()
        });
      })
      .catch(() => {
        console.warn('[Outbox] Sin conexión. Encolando en IndexedDB...');
  
        return guardarRegistro({
          ...datosFormulario,
          estado: 'pendiente',
          fechaCreacion: Date.now()
        })
          .then(() => {
            // Detección de soporte para Background Sync API
            if ('serviceWorker' in navigator && 'SyncManager' in window) {
              return navigator.serviceWorker.ready
                .then((registro) => {
                  console.log('[Outbox] Registrando etiqueta sync-reportes en el SW...');
                  return registro.sync.register('sync-reportes');
                });
            }
          });
      })
  }
   

  function sincronizarPendientesFallback(){
    console.log('[Outbox] Conexión detectada. Buscando registros pendientes...');

    return obtenerTodosLosRegistros()
      .then((registros) => {
        const pendientes = registros.filter((item) => item.estado === 'pendiente');

        if (pendientes.length === 0) {
          console.log('[Outbox] No hay transacciones pendientes por sincronizar.');
          return;
        }

        // Convertir cada registro pendiente en una promesa de envío + actualización
        const promesasDeEnvio = pendientes.map((item) => {
          return fetch('https://jsonplaceholder.typicode.com/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: item.titulo, body: item.descripcion })
          })
            .then((res) => {
              if (!res.ok) throw new Error('Falla al reintentar envío');
              // Actualizar estado en IndexedDB de 'pendiente' a 'sincronizado'
              return actualizarEstadoRegistro(item.id, 'sincronizado');
            });
        });

        // Esperar a que todos los reenvíos concluyan
        return Promise.all(promesasDeEnvio);
      })
      .then(() => {
        return renderizarColaOutbox();
      })
      .catch((error) => {
        console.error('[Outbox] Error durante la sincronización masiva:', error);
      });
  }

  // Escuchar el regreso de la conectividad
  window.addEventListener('online', () => {
    actualizarIndicadorRed();
  
    // Degradación elegante: Solo sincronizar desde UI si el navegador NO soporta Background Sync (ej. Safari/iOS)
    if (!('SyncManager' in window)) {
      console.log('[Outbox] Navegador sin SyncManager. Ejecutando fallback por evento online...');
      sincronizarPendientesFallback();
    }
  });
  function renderizarColaOutbox() {
    return obtenerTodosLosRegistros().then(function (registros) {
      var lista = document.getElementById('lista-outbox');
      lista.innerHTML = '';

      registros.forEach(function (item) {
        var li = document.createElement('li');

        // Construir el texto con los datos del registro
        li.textContent = `${item.titulo} - ${item.estado} - ${new Date(item.fechaCreacion).toLocaleString()}`;

        lista.appendChild(li);
      });
    });
  }

  document.getElementById('form-incidencia').addEventListener('submit', function (e) {
    e.preventDefault();

    var titulo = document.getElementById('titulo').value;
    var descripcion = document.getElementById('descripcion').value;

    procesarEnvioReporte({ titulo: titulo, descripcion: descripcion })
      .then(function () {
        // Limpia el formulario y vuelve a dibujar la cola
        document.getElementById('form-incidencia').reset();

        return renderizarColaOutbox();
      })
      .catch(function (error) {
        console.error('Error al procesar el envío:', error);
      });
  });

  document.getElementById('btn-purgar').addEventListener('click', function () {
    obtenerTodosLosRegistros()
      .then(function (registros) {
        var enviados = registros.filter(function (item) {
          return item.estado === 'sincronizado';
        });

        var promesas = enviados.map(function (item) {
          return eliminarRegistro(item.id);
        });

        return Promise.all(promesas);
      })
      .then(function () {
        return renderizarColaOutbox();
      })
      .catch(function (error) {
        console.error('Error al purgar:', error);
      });
  });

  function actualizarIndicadorRed() {
    var badge = document.getElementById('badge-red');

    if (navigator.onLine) {
      badge.textContent = 'En Línea';
      badge.className = 'badge online';
    } else {
      badge.textContent = 'Sin Conexión';
      badge.className = 'badge offline';
    }
  }

  // Carga inicial: dibujar la cola y el indicador al abrir la página
  renderizarColaOutbox();
  actualizarIndicadorRed();
