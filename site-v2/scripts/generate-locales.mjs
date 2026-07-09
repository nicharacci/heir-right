import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "index.html");
const spanishPath = resolve(root, "es/index.html");

const text = new Map([
  ["HeirRight Real Estate", "HeirRight Real Estate"],
  ["How it works", "Como funciona"],
  ["What we handle", "Lo que manejamos"],
  ["Gallery", "Galeria"],
  ["Reviews", "Resenas"],
  ["Legal", "Legal"],
  ["Book A Call", "Agendar llamada"],
  ["Inheritance recovery across South Florida and Texas", "Recuperacion de herencias en el sur de Florida y Texas"],
  ["As an heir, you have rights - claim them.", "Como heredero, usted tiene derechos: reclamemoslos."],
  [
    "At HeirRight, we cut through the legal and financial chaos that comes with inheriting real property. We uncover and offer tailored solutions to resolve your inherited home.",
    "En HeirRight, simplificamos el caos legal y financiero que acompana heredar bienes raices. Identificamos y ofrecemos soluciones a la medida para resolver su casa heredada."
  ],
  ["No more headaches. Just results.", "Sin mas dolores de cabeza. Solo resultados."],
  ["Get a free consultation", "Obtenga una consulta gratis"],
  ["Call 786-962-3457", "Llame al 786-962-3457"],
  ["attorney-fee pressure to start", "presion inicial por honorarios legales"],
  ["As-is", "Tal como esta"],
  ["where-is property purchase path", "opcion de compra en la condicion actual"],
  ["Heirs", "Herederos"],
  ["liens, taxes, and disputes reviewed", "gravamenes, impuestos y disputas revisados"],
  ["We help resolve", "Ayudamos a resolver"],
  ["Probate, estate litigation, liens, ownership disputes", "Sucesion, litigios patrimoniales, gravamenes y disputas de propiedad"],
  ["Get my free consultation", "Obtener mi consulta gratis"],
  ["Probate, title, lien, and co-heir concerns", "Asuntos de sucesion, titulo, gravamenes y coherederos"],
  ["As-is sale options with no repairs required to start", "Opciones de venta tal como esta, sin reparaciones para empezar"],
  ["A plain-language review before any next step", "Una revision en lenguaje claro antes de cualquier siguiente paso"],
  ["Get my free offer", "Obtener mi oferta gratis"],
  ["We pay attorney fees", "Pagamos los honorarios legales"],
  ["HeirRight helps remove the legal-cost barrier that can keep estates stuck.", "HeirRight ayuda a quitar la barrera de costos legales que puede mantener una herencia detenida."],
  ["We buy as-is", "Compramos tal como esta"],
  ["No clean-out, repair, showing, or traditional listing process is required to start.", "No se requiere limpieza, reparaciones, visitas ni un listado tradicional para empezar."],
  ["We handle disputes", "Manejamos disputas"],
  ["Ownership questions with heirs, creditors, liens, and tax issues are part of the work.", "Las preguntas de propiedad con herederos, acreedores, gravamenes e impuestos son parte del trabajo."],
  ["We guide the process", "Guiamos el proceso"],
  ["Our team explains what has to happen so families can decide with less stress.", "Nuestro equipo explica lo que debe suceder para que las familias puedan decidir con menos estres."],
  ["We take care of", "Nos encargamos de"],
  ["the heavy lifting", "el trabajo pesado"],
  [
    "All over South Florida and Texas, our clients entrust us to help identify unclaimed real estate and manage every aspect of the inheritance recovery process. We understand that hiring attorneys to complete probates and resolve legal disputes can take months and cost tens of thousands of dollars.",
    "En todo el sur de Florida y Texas, nuestros clientes confian en nosotros para ayudar a identificar bienes raices no reclamados y manejar cada parte del proceso de recuperacion de herencias. Entendemos que contratar abogados para completar sucesiones y resolver disputas legales puede tomar meses y costar decenas de miles de dolares."
  ],
  [
    "With the help of our trusted attorneys, financial advisors, and investigators, we support each claim with thorough research and accurate documentation. Whether it involves legal or credit disputes, locating additional heirs, or resolving liens, we bring the work to the finish line so families can receive what is rightfully theirs.",
    "Con la ayuda de abogados, asesores financieros e investigadores de confianza, respaldamos cada reclamo con investigacion detallada y documentacion precisa. Ya sea que implique disputas legales o de credito, ubicar herederos adicionales o resolver gravamenes, llevamos el trabajo hasta el final para que las familias reciban lo que les corresponde."
  ],
  ["Attorney fees", "Honorarios legales"],
  ["We cover all attorney fees with our experienced legal team.", "Cubrimos todos los honorarios legales con nuestro equipo legal experimentado."],
  ["Ownership disputes", "Disputas de propiedad"],
  ["We handle legal ownership disputes with all heirs and lien holders.", "Manejamos disputas legales de propiedad con todos los herederos y titulares de gravamenes."],
  ["Creditor claims, liens and tax issues", "Reclamos de acreedores, gravamenes e impuestos"],
  ["We resolve and mitigate creditor claims, liens and tax issues.", "Resolvemos y mitigamos reclamos de acreedores, gravamenes y asuntos de impuestos."],
  ["Property condition", "Condicion de la propiedad"],
  ["We handle the property in any condition.", "Manejamos la propiedad en cualquier condicion."],
  ["The HeirRight Estate", "El proceso HeirRight"],
  ["Settlement Process", "de resolucion patrimonial"],
  ["CLAIM MONEY FROM YOUR INHERITED HOUSE HASSLE-FREE", "RECLAME DINERO DE SU CASA HEREDADA SIN COMPLICACIONES"],
  ["Tell us about the home", "Cuentenos sobre la casa"],
  ["Discover what is rightfully yours", "Descubra lo que le corresponde"],
  [
    "Discover your unclaimed real estate inheritance.",
    "Descubra su herencia inmobiliaria no reclamada."
  ],
  ["We review the inheritance path", "Revisamos el camino de la herencia"],
  ["Tailored solutions to your inheritance path", "Soluciones a la medida para su camino de herencia"],
  [
    "Our team reviews the case, crafts a tailored legal strategy and explains the next steps in plain language.",
    "Nuestro equipo revisa el caso, crea una estrategia legal a la medida y explica los siguientes pasos en lenguaje claro."
  ],
  ["Move toward a hassle-free sale", "Avance hacia una venta sin complicaciones"],
  ["We move fast to get you paid", "Avanzamos rapido para que cobre"],
  [
    "If the fit is right, HeirRight carries the heavy load so you can receive what is rightfully yours.",
    "Si es una buena opcion, HeirRight lleva la carga pesada para que usted pueda recibir lo que le corresponde."
  ],
  ["Real families, real settlements.", "Familias reales, acuerdos reales."],
  ["Traditional sale vs HeirRight way", "Venta tradicional vs la forma HeirRight"],
  ["What matters", "Lo importante"],
  ["Traditional sale", "Venta tradicional"],
  ["Timing & attorneys", "Tiempo y abogados"],
  ["Dealing with attorneys that will take months/years to settle the estate.", "Tratar con abogados puede tomar meses o anos para resolver el patrimonio."],
  ["Quickest turnaround time to get our clients paid.", "El plazo mas rapido para que nuestros clientes cobren."],
  ["Property condition", "Condicion de la propiedad"],
  ["Showings, repairs, clean-out, and disruption can fall on you.", "Las visitas, reparaciones, limpieza y molestias pueden caer sobre usted."],
  ["As-is, where is.", "Tal como esta, donde esta."],
  ["Closing costs", "Costos de cierre"],
  ["6-8% in closing costs, fees, and commissions can stack up.", "El 6-8% en costos de cierre, cargos y comisiones puede acumularse."],
  ["No traditional listing path is required to start the conversation.", "No se requiere un listado tradicional para iniciar la conversacion."],
  ["Creditor Claims, Liens and taxes", "Reclamos de acreedores, gravamenes e impuestos"],
  ["Unpaid creditor claims, taxes, judgments, and liens can slow or block a sale.", "Reclamos de acreedores, impuestos, sentencias y gravamenes sin pagar pueden retrasar o bloquear una venta."],
  ["We work to wipe out, mitigate and resolve all title encumbrances.", "Trabajamos para eliminar, mitigar y resolver todos los gravamenes del titulo."],
  ["Heir disputes", "Disputas entre herederos"],
  ["All heirs have to be in agreement.", "Todos los herederos deben estar de acuerdo."],
  ["Not all heirs need to be in agreement. We resolve ownership disputes.", "No todos los herederos tienen que estar de acuerdo. Resolvemos disputas de propiedad."],
  ["Guidance", "Orientacion"],
  ["You may be left to coordinate attorneys, advisors, and title questions alone.", "Puede quedar coordinando solo abogados, asesores y preguntas de titulo."],
  ["Professional legal counsel in your corner the whole step of the way.", "Asesoria legal profesional de su lado durante todo el proceso."],
  ["Free consultation", "Consulta gratis"],
  ["We handle the hassle, you collect the check.", "Nosotros manejamos las complicaciones, usted cobra el cheque."],
  ["Curious to know how much your inheritance is worth?", "Quiere saber cuanto vale su herencia?"],
  [
    "You do not have to wait on every other heir to ask questions. Contact HeirRight today and we will break the process down, and help you decide the best next steps.",
    "No tiene que esperar a todos los demas herederos para hacer preguntas. Contacte a HeirRight hoy y le explicaremos el proceso y le ayudaremos a decidir los mejores siguientes pasos."
  ],
  ["Your Profile", "Su perfil"],
  ["Property Details", "Detalles de la propiedad"],
  ["Your Message", "Su mensaje"],
  ["Company website", "Sitio web de la compania"],
  ["Your Profile", "Su perfil"],
  ["Hi, thanks for choosing HeirRight!", "Gracias por elegir HeirRight."],
  ["What's your Name?", "Cual es su nombre?"],
  ["Start with your name and we will walk you through the rest.", "Empiece con su nombre y le guiaremos por el resto."],
  ["Continue", "Continuar"],
  ["Pleasure to meet with you!", "Un placer conocerle."],
  ["How do we contact you?", "Como podemos contactarle?"],
  ["What's the address of the property you want more information on?", "Cual es la direccion de la propiedad sobre la que quiere mas informacion?"],
  ["We will use this to understand the property and the best way to reach you.", "Usaremos esto para entender la propiedad y la mejor forma de contactarle."],
  ["Next", "Siguiente"],
  ["Anything we should know?", "Hay algo que debamos saber?"],
  ["Add notes, requests, etc.", "Agregue notas, solicitudes, etc."],
  ["Request Received", "Solicitud recibida"],
  [
    "You're officially one step closer to closing. A member of our team will contact you shortly; thanks for choosing HeirRight!",
    "Ya esta un paso mas cerca del cierre. Un miembro de nuestro equipo le contactara pronto; gracias por elegir HeirRight."
  ],
  ["Get My Free Offer", "Obtener mi oferta gratis"],
  ["Your home address", "Direccion de la casa"],
  ["Name", "Nombre"],
  ["Email", "Correo electronico"],
  ["Phone", "Telefono"],
  ["Tell us about your home", "Cuentenos sobre su casa"],
  [
    "Call 786-962-3457 for any questions & concerns, & we'd be happy to assist you!",
    "Llame al 786-962-3457 si tiene preguntas o inquietudes, y con gusto le ayudaremos."
  ],
  [
    "Please contact us today at 786-962-3457. We will break the process down for you, answer any questions, and if it makes sense, make it a hassle free sale.",
    "Contactenos hoy al 786-962-3457. Le explicaremos el proceso, responderemos sus preguntas y, si tiene sentido, haremos que sea una venta sin complicaciones."
  ],
  ["Submit", "Enviar"],
  ["Inheritance without Hassle.", "Herencia sin complicaciones."],
  ["Terms of Use", "Terminos de uso"],
  ["Privacy Policy", "Politica de privacidad"],
  ["Tell us about the inherited home, liens, repairs, heirs, or timing.", "Cuentenos sobre la casa heredada, gravamenes, reparaciones, herederos o tiempos."]
]);

const attributes = new Map([
  ["HeirRight helps heirs resolve inherited property, handle legal fees, address liens and ownership disputes, and move toward a hassle-free estate settlement.", "HeirRight ayuda a herederos a resolver propiedades heredadas, manejar honorarios legales, atender gravamenes y disputas de propiedad, y avanzar hacia una solucion patrimonial sin complicaciones."],
  ["As an heir, you have rights. HeirRight helps you resolve inherited real property without the legal and financial chaos.", "Como heredero, usted tiene derechos. HeirRight le ayuda a resolver bienes raices heredados sin el caos legal y financiero."],
  ["HeirRight inherited property settlement", "Solucion de propiedades heredadas con HeirRight"],
  ["HeirRight start", "Inicio de HeirRight"],
  ["Primary navigation", "Navegacion principal"],
  ["Primary actions", "Acciones principales"],
  ["Consultation progress", "Progreso de la consulta"],
  ["Your profile", "Su perfil"],
  ["Property details", "Detalles de la propiedad"],
  ["Your message", "Su mensaje"],
  ["Inherited property reviewed by HeirRight", "Propiedad heredada revisada por HeirRight"],
  ["Why families work with HeirRight", "Por que las familias trabajan con HeirRight"],
  ["Trust and review checklist", "Lista de confianza y revision"],
  ["HeirRight property and client media gallery", "Galeria de propiedades y clientes de HeirRight"],
  ["Stone inherited property exterior with a landscaped lawn", "Exterior de una propiedad heredada de piedra con jardin cuidado"],
  ["Single-story inherited property with a circular driveway", "Propiedad heredada de una planta con entrada circular"],
  ["Inherited home driveway lined with hedges and palm trees", "Entrada de casa heredada con setos y palmeras"],
  ["Front lawn and driveway of a South Florida inherited home", "Jardin frontal y entrada de una casa heredada del sur de Florida"],
  ["White modern inherited property with a gated driveway", "Propiedad heredada moderna blanca con entrada cerrada"],
  ["Palm-lined driveway leading to a residential inherited property", "Entrada con palmeras hacia una propiedad residencial heredada"],
  ["Inherited home exterior with a for-sale sign near the hedge", "Exterior de casa heredada con letrero de venta junto al seto"],
  ["Family seated together in a restaurant booth", "Familia sentada junta en un restaurante"],
  ["Joshua standing in front of a residential property", "Joshua de pie frente a una propiedad residencial"],
  ["Closing photo with three people holding a congratulations key sign", "Foto de cierre con tres personas sosteniendo un letrero de felicitaciones"],
  ["Client couple standing with Joshua in an office", "Pareja de clientes de pie con Joshua en una oficina"],
  ["Client holding a sold sign with Joshua", "Cliente sosteniendo un letrero de vendido con Joshua"],
  ["Family holding a congratulations sign at closing", "Familia sosteniendo un letrero de felicitaciones en el cierre"],
  ["Three people standing with a Patriot Title sign", "Tres personas de pie con un letrero de Patriot Title"],
  ["Client standing with Joshua in a high-rise office", "Cliente de pie con Joshua en una oficina de edificio alto"],
  ["Balcony view overlooking trees, buildings, and water", "Vista desde balcon hacia arboles, edificios y agua"],
  ["HeirRight client testimonial video player", "Reproductor de videos testimoniales de clientes de HeirRight"],
  ["Play selected client testimonial", "Reproducir testimonio seleccionado"],
  ["Choose a client testimonial video", "Elija un video testimonial de cliente"],
  ["Play client testimonial video 1", "Reproducir video testimonial de cliente 1"],
  ["Play client testimonial video 2", "Reproducir video testimonial de cliente 2"],
  ["Play client testimonial video 3", "Reproducir video testimonial de cliente 3"],
  ["Play client testimonial video 4", "Reproducir video testimonial de cliente 4"],
  ["Play client testimonial video 5", "Reproducir video testimonial de cliente 5"],
  ["Play client testimonial video 6", "Reproducir video testimonial de cliente 6"],
  ["HeirRight Google rating badge showing 5.0 stars", "Insignia de calificacion de Google de HeirRight con 5.0 estrellas"],
  ["Google Business Profile review cards", "Tarjetas de resenas del Perfil de Empresa en Google"],
  ["5 out of 5 stars", "5 de 5 estrellas"],
  ["Google Business Profile review screenshots", "Capturas de resenas del Perfil de Empresa en Google"],
  ["Google Business Profile review screenshot from Daniela Armenta", "Captura de resena de Google de Daniela Armenta"],
  ["Google Business Profile review screenshots from Max Khalus, David Diaz, and Jessica Escobar-Ramos", "Capturas de resenas de Google de Max Khalus, David Diaz y Jessica Escobar-Ramos"],
  ["Joshua standing in a suit beside a family photo", "Joshua con traje junto a una foto familiar"],
  ["Founder Joshua Hernandez in a suit", "Fundador Joshua Hernandez con traje"],
  ["Joshua Hernandez seated with his family", "Joshua Hernandez sentado con su familia"],
  ["HeirRight heritage facts", "Datos de trayectoria de HeirRight"],
  ["Traditional sale", "Venta tradicional"],
  ["123 Estate Lane", "123 Calle Herencia"],
  ["Alex Morgan", "Alex Morgan"],
  ["alex.morgan@example.com", "alex.morgan@example.com"],
  ["+1 (212) 555-0187", "+1 (212) 555-0187"],
  ["Tell us about the inherited home, liens, repairs, heirs, or timing.", "Cuentenos sobre la casa heredada, gravamenes, reparaciones, herederos o tiempos."]
]);

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function translateTextNodes(html) {
  return html
    .split(/(<[^>]+>)/g)
    .map((part) => {
      if (part.startsWith("<")) return part;
      const key = normalize(part);
      if (!key || !text.has(key)) return part;
      const leading = part.match(/^\s*/)?.[0] ?? "";
      const trailing = part.match(/\s*$/)?.[0] ?? "";
      return `${leading}${text.get(key)}${trailing}`;
    })
    .join("");
}

function translateAttributes(html) {
  return html.replace(/\b(content|aria-label|alt|placeholder|data-gallery-alt|data-label)="([^"]*)"/g, (match, name, value) => {
    if (attributes.has(value)) {
      return `${name}="${attributes.get(value)}"`;
    }

    if (value.startsWith("View ")) {
      const subject = value.slice(5);
      const translatedSubject = attributes.get(subject);
      if (translatedSubject) {
        return `${name}="Ver ${translatedSubject}"`;
      }
    }

    return match;
  });
}

let html = await readFile(sourcePath, "utf8");

html = html
  .replace('<html lang="en">', '<html lang="es">')
  .replace('<body class="landing-page">', '<body class="landing-page" data-locale="es">')
  .replace('<link rel="canonical" href="https://heirright.com/" />', '<link rel="canonical" href="https://heirright.com/es/" />')
  .replace('<a class="brand" href="/" aria-label="HeirRight start">', '<a class="brand" href="/es/" aria-label="HeirRight start">')
  .replace('<a href="/legal.html">Legal</a>', '<a href="/legal.html" hreflang="en">Legal</a>')
  .replace('<a class="inline-cta" href="/legal.html">', '<a class="inline-cta" href="/legal.html" hreflang="en">')
  .replace('<a class="footer-brand" href="/" aria-label="HeirRight home">', '<a class="footer-brand" href="/es/" aria-label="Inicio de HeirRight">')
  .replaceAll('href="/es/" lang="es" hreflang="es">Español', 'href="/" lang="en" hreflang="en">English');

html = translateAttributes(translateTextNodes(html));

await mkdir(dirname(spanishPath), { recursive: true });
await writeFile(spanishPath, html);

console.log(`Generated ${spanishPath}`);
