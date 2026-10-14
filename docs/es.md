# FordPass

Integra sus vehículos Ford en Gladys: nivel de combustible o de batería,
autonomía, kilometraje, cierre, alarma, puertas y ventanillas, presión de los
neumáticos, posición y las órdenes remotas de la aplicación FordPass
(bloquear, desbloquear, arranque remoto, carga).

> Esta integración usa los mismos servidores que la aplicación móvil
> FordPass. Ford no ofrece una API pública para ello: Ford puede cambiarla en
> cualquier momento, y la integración puede necesitar entonces una
> actualización.

## Requisitos

- Una cuenta FordPass con sus vehículos añadidos y **activados** en la
  aplicación FordPass (los servicios conectados deben estar activados).
- Un ordenador con un navegador de escritorio (Chrome, Edge, Firefox…) para el
  inicio de sesión, que se hace una sola vez.

## Conectar su cuenta

Ford inicia la sesión en su propia página y luego intenta abrir la aplicación
FordPass. Un navegador no puede abrir la aplicación, así que se copia la
dirección final a mano. Lleva dos minutos, una sola vez.

1. En Gladys, abra la pestaña **Configuración** de la integración y elija la
   **región** de su cuenta FordPass. Guarde.
2. Pulse **Conectar** junto a _Cuenta Ford_. La página de inicio de sesión de
   Ford se abre en una pestaña nueva. No inicie sesión ahí: copie la
   dirección de esa página desde la barra de direcciones y cierre la
   pestaña.
3. Abra una pestaña nueva, abra las **herramientas de desarrollo** del
   navegador (`F12`, o `Ctrl+Mayús+I` / `Cmd+Opción+I` en Mac), seleccione la
   pestaña **Red** y marque **Conservar registro** (Firefox: ⚙ → **Persistir
   registros**). Las herramientas de desarrollo solo registran la pestaña en
   la que se abrieron, y el inicio de sesión pasa por varias páginas (entre
   ellas la del código de verificación): sin esta casilla, la lista se vacía
   por el camino.
4. Pegue la dirección copiada en la barra de direcciones de esta pestaña y
   pulse `Intro`. Inicie sesión con el correo y la contraseña de su cuenta
   FordPass y luego introduzca el código de verificación que le envía Ford
   (autenticación de dos factores).
5. La página parece cargar indefinidamente: es lo esperado. En la pestaña
   **Red**, la última petición aparece **en rojo**; su iniciador es
   `authorize?redirect_uri=fordapp://userauthorized&…` y su dirección empieza
   por `fordapp://userauthorized/?code=` (escriba `code=` en el filtro para
   encontrarla). Clic derecho → **Copiar** → **Copiar URL**. En Firefox, la
   dirección puede aparecer en la consola como un error («se impidió
   abrir»): cópiela desde ahí.
6. De vuelta en Gladys, ejecute la acción **Completar el inicio de sesión** y
   pegue la dirección. Hágalo enseguida: el código solo es válido unos
   minutos, y el inicio de sesión debe completarse en los 10 minutos
   siguientes al clic en **Conectar**.
7. La respuesta lista los vehículos encontrados. Abra la pestaña
   **Descubrimiento** y añádalos.

Su contraseña nunca pasa por Gladys: la integración solo recibe un código de
un solo uso, cambiado por tokens guardados en la configuración de la
integración. Ford mantiene la sesión durante meses; si caduca (contraseña
cambiada, demasiado tiempo sin uso), la pantalla de configuración lo indica:
repita los pasos anteriores.

## El vehículo en Gladys

Cada vehículo es un dispositivo. Sus funciones dependen de su motorización:

| Función                                       | Gasolina / diésel / híbrido | Eléctrico / híbrido enchufable |
| --------------------------------------------- | :-------------------------: | :----------------------------: |
| Cuentakilómetros                              |              ✓              |               ✓                |
| Nivel de combustible, autonomía (combustible) |              ✓              |  ✓ (solo híbrido enchufable)   |
| Carga de la batería, autonomía eléctrica      |                             |               ✓                |
| Cargando (controlable), enchufado, potencia   |                             |               ✓                |
| Batería de 12 V                               |              ✓              |               ✓                |
| Cierre centralizado (controlable)             |              ✓              |               ✓                |
| Alarma activada                               |              ✓              |               ✓                |
| Puerta abierta, ventanilla abierta            |              ✓              |               ✓                |
| Arranque remoto (controlable)                 |              ✓              |               ✓                |
| Vida útil del aceite                          |              ✓              |  ✓ (solo híbrido enchufable)   |
| Temperatura exterior                          |              ✓              |               ✓                |
| Presión de cada neumático                     |              ✓              |               ✓                |

Un valor que su vehículo no informa simplemente queda vacío.

La función **Cierre centralizado** bloquea (encendido) y desbloquea (apagado)
el vehículo, **Arranque remoto** arranca el motor o la climatización previa
(encendido) o la detiene (apagado), **Cargando** inicia o detiene la carga.
Ford transmite una orden al coche en 10 a 60 segundos; la función muestra
después el estado confirmado por el coche.

## Ajustes

- **Intervalo de actualización**: frecuencia de lectura de cada vehículo
  (5 minutos por defecto, 1 minuto como mínimo). La lectura solo recupera lo
  que los servidores de Ford ya conocen: nunca despierta el coche ni vacía su
  batería. El coche envía nuevos valores por sí mismo cuando circula, se
  bloquea, se carga…
- **Unidad de distancia** y **unidad de presión de neumáticos**.
- **Umbral de combustible / batería bajo**: el nivel que activa el disparador
  _Combustible o batería bajos_ (15 % por defecto).
- **Idioma de los nombres de funciones**: inglés, francés, alemán o español,
  aplicado al añadir un vehículo a Gladys.

## Acciones

- **Completar el inicio de sesión** — véase arriba.
- **Probar la conexión** — lista los vehículos de la cuenta.
- **Desconectar de Ford** — borra los tokens guardados. Los vehículos
  permanecen en Gladys con su historial.

## Escenas

La integración añade sus propias tarjetas al editor de escenas (Gladys 5.1 o
posterior).

Disparadores:

- **Combustible o batería bajos** — el nivel bajó del umbral configurado.
  Filtre por vehículo y por energía (combustible, batería). Variables:
  `{{triggerEvent.data.energy}}`, `{{triggerEvent.data.level}}`.
- **Alarma disparada** — la alarma antirrobo se ha disparado. Variables:
  `latitude` y `longitude` del vehículo.
- **Aviso de presión de neumáticos** — el control de presión ha señalado una
  rueda. Variables: `wheel` (p. ej. `rear_left`), `pressure`.
- **Carga terminada** — un vehículo eléctrico o híbrido enchufable ha dejado
  de cargar. Variables: `level`, `range`.
- **Contacto encendido o apagado** — inicio o fin de trayecto. Filtre por
  _Encendido_ / _Apagado_. Variables: `state`, `odometer`.

Las funciones del dispositivo también funcionan con el disparador estándar
_Un dispositivo cambia de estado_ (p. ej. «Cierre centralizado pasa a 0»).

Acciones:

- **Enviar una orden a un vehículo Ford** — bloquear, desbloquear, arranque
  remoto, detener el arranque remoto, iniciar o detener la carga, o
  actualizar los datos (esta despierta el vehículo: limitada a 24 al día).
  Salidas: `success` y `status`, para que las acciones siguientes comprueben
  que el coche obedeció.
- **Leer el estado de un vehículo Ford** — los últimos valores conocidos por
  Ford, utilizables en las acciones siguientes: `odometer`, `fuel_level`,
  `battery_level`, `range`, `locked`, `doors_open`, `windows_open`,
  `charging`, `latitude`, `longitude`.

Ejemplo: _cada noche a las 22 h → leer el estado del vehículo → si `locked`
es falso → enviar la orden «Bloquear» y una notificación_.

## Panel

- **Vehículo Ford** — elija un vehículo: energía, autonomía y kilometraje en
  directo, el estado del cierre, la alarma, las puertas, las ventanillas, los
  neumáticos y la carga, la hora de la última actualización, y botones para
  bloquear, desbloquear (con confirmación), actualizar y abrir la posición en
  un mapa.
- **Vehículos Ford** — todos los vehículos de la cuenta con su nivel,
  autonomía, cierre y un enlace al mapa.

## Solución de problemas

- **«Ford rechazó el inicio de sesión»**: el código caducó o ya se usó.
  Pulse de nuevo **Conectar** y pegue la nueva dirección enseguida. Compruebe
  la región.
- **«No hay ningún inicio de sesión en curso»**: han pasado más de 10 minutos
  desde el clic en **Conectar**: vuelva a pulsarlo.
- **Ningún vehículo encontrado**: el vehículo debe estar añadido y activado
  en la aplicación FordPass con la misma cuenta.
- **«Vehicle not authorized»** en los registros: acepte de nuevo los
  servicios conectados en la aplicación FordPass.
- **Una orden falla**: el vehículo puede estar en reposo profundo (sin uso
  durante días, batería de 12 V baja), sin cobertura móvil, o rechazar la
  orden (arranque remoto con una puerta abierta, alarma…). El widget muestra
  «Órdenes en pausa» durante el reposo profundo.
- **Los valores no cambian**: el coche solo envía nuevos valores cuando se
  usa; pulse _Actualizar_ en el widget para pedírselos.

Los registros de la integración (Gladys → Integraciones → FordPass) nunca
contienen sus tokens ni su contraseña.
