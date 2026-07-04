import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "index.html");
const spanishPath = resolve(root, "es/index.html");

const text = new Map([
  ["HeirRight | Inherited Property Settlement", "HeirRight | Solucion para propiedades heredadas"],
  ["How it works", "Como funciona"],
  ["What we handle", "Lo que manejamos"],
  ["Gallery", "Galeria"],
  ["Reviews", "Resenas"],
  ["Legal", "Legal"],
  ["Free consult", "Consulta gratis"],
  ["Inheritance recovery across South Florida and Texas", "Recuperacion de herencias en el sur de Florida y Texas"],
  ["Resolve your inherited property hassle-free.", "Resuelva su propiedad heredada sin complicaciones."],
  [
    "We specialize in offering a quick solution to help clients settle inherited homes. We handle the legal fees, coordinate the heavy lifting, and help families move toward a clear as-is resolution.",
    "Nos especializamos en ofrecer una solucion rapida para ayudar a nuestros clientes a resolver casas heredadas. Cubrimos los honorarios legales, coordinamos el trabajo pesado y ayudamos a las familias a avanzar hacia una solucion clara, en condicion actual."
  ],
  ["Get free consultation", "Obtenga una consulta gratis"],
  ["Call 786-962-3457", "Llame al 786-962-3457"],
  ["attorney-fee pressure to start", "presion inicial por honorarios legales"],
  ["As-is", "Tal como esta"],
  ["where-is property purchase path", "opcion de compra en la condicion actual"],
  ["Heirs", "Herederos"],
  ["liens, taxes, and disputes reviewed", "gravamenes, impuestos y disputas revisados"],
  ["Get paid for your inheritance without complications", "Reciba pago por su herencia sin complicaciones"],
  ["Tell us what is stuck. We will break down the process.", "Cuentenos que esta detenido. Le explicaremos el proceso."],
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
  ["We pay all attorney fees.", "Pagamos todos los honorarios legales."],
  ["Ownership disputes", "Disputas de propiedad"],
  ["We handle legal ownership disputes with all heirs and creditors.", "Manejamos disputas legales de propiedad con todos los herederos y acreedores."],
  ["Liens and tax issues", "Gravamenes e impuestos"],
  ["We resolve liens and tax issues.", "Resolvemos gravamenes y asuntos de impuestos."],
  ["Property condition", "Condicion de la propiedad"],
  ["We buy as is-where is.", "Compramos tal como esta y donde esta."],
  ["The HeirRight Estate", "El proceso HeirRight"],
  ["Settlement Process", "de resolucion patrimonial"],
  ["Tell us about the home", "Cuentenos sobre la casa"],
  [
    "Share the property address, who is involved, and what feels stuck: probate, liens, code issues, taxes, co-heirs, repairs, or timing.",
    "Comparta la direccion de la propiedad, quienes estan involucrados y que esta detenido: sucesion, gravamenes, violaciones de codigo, impuestos, coherederos, reparaciones o tiempo."
  ],
  ["We review the inheritance path", "Revisamos el camino de la herencia"],
  [
    "Our team reviews the property, documentation, taxes, liens, and ownership questions, then explains the next step in plain language.",
    "Nuestro equipo revisa la propiedad, documentos, impuestos, gravamenes y preguntas de propiedad, y luego explica el siguiente paso en lenguaje claro."
  ],
  ["Move toward a hassle-free sale", "Avance hacia una venta sin complicaciones"],
  [
    "If the fit is right, HeirRight carries the heavy load so you can receive what is rightfully yours without the traditional sale drag.",
    "Si es una buena opcion, HeirRight lleva la carga pesada para que usted pueda recibir lo que le corresponde sin el desgaste de una venta tradicional."
  ],
  ["Plain review boundaries", "Limites claros de revision"],
  ["Clear next steps before anyone asks you to decide.", "Pasos claros antes de pedirle que decida."],
  [
    "Inherited homes can get stuck for months when probate, taxes, liens, repairs, and co-heir questions overlap. HeirRight makes the first step easier by explaining what can be reviewed, what outside professionals may need to handle, and what a realistic sale path can look like.",
    "Las casas heredadas pueden quedar detenidas por meses cuando se cruzan sucesion, impuestos, gravamenes, reparaciones y preguntas entre coherederos. HeirRight facilita el primer paso explicando que se puede revisar, que profesionales externos podrian manejar y como puede verse una ruta de venta realista."
  ],
  ["Review includes", "La revision incluye"],
  ["Property address and ownership situation", "Direccion de la propiedad y situacion de propiedad"],
  ["Known liens, tax issues, code violations, or repairs", "Gravamenes conocidos, impuestos, violaciones de codigo o reparaciones"],
  ["Heir, creditor, or dispute concerns", "Inquietudes con herederos, acreedores o disputas"],
  ["Timing and as-is sale options", "Tiempos y opciones de venta tal como esta"],
  ["Trust layer", "Capa de confianza"],
  ["Trusted attorney and advisor coordination when needed", "Coordinacion con abogados y asesores de confianza cuando sea necesario"],
  ["Free consultation before any proposed transaction", "Consulta gratis antes de cualquier transaccion propuesta"],
  ["Readable Terms of Use and Privacy Policy", "Terminos de uso y politica de privacidad faciles de leer"],
  ["No website promise of legal advice", "El sitio web no promete asesoria legal"],
  ["HeirRight archive", "Archivo de HeirRight"],
  ["Real properties, closings, and families from our work.", "Propiedades reales, cierres y familias de nuestro trabajo."],
  ["Compare your options", "Compare sus opciones"],
  ["Traditional sale vs. HeirRight", "Venta tradicional vs. HeirRight"],
  ["What matters", "Lo importante"],
  ["Traditional sale", "Venta tradicional"],
  ["Timing", "Tiempo"],
  ["The months it takes to sell add up.", "Los meses que toma vender se acumulan."],
  ["We move quickly once the property, heirs, and title questions are reviewed.", "Avanzamos rapido una vez revisadas la propiedad, los herederos y las preguntas de titulo."],
  ["Property condition", "Condicion de la propiedad"],
  ["Showings, repairs, clean-out, and disruption can fall on you.", "Las visitas, reparaciones, limpieza y molestias pueden caer sobre usted."],
  ["We buy the property as is-where is.", "Compramos la propiedad tal como esta y donde esta."],
  ["Closing costs", "Costos de cierre"],
  ["1-2% in closing costs, fees, and commissions can stack up.", "El 1-2% en costos de cierre, cargos y comisiones puede acumularse."],
  ["No traditional listing path is required to start the conversation.", "No se requiere un listado tradicional para iniciar la conversacion."],
  ["Liens and taxes", "Gravamenes e impuestos"],
  ["Unpaid taxes, judgments, and liens can slow or block a sale.", "Impuestos sin pagar, sentencias y gravamenes pueden retrasar o bloquear una venta."],
  ["We work to wipe out or negotiate down liens and judgments.", "Trabajamos para eliminar o negociar gravamenes y sentencias."],
  ["Heir disputes", "Disputas entre herederos"],
  ["Co-heir questions can turn a simple sale into months of back-and-forth.", "Las preguntas entre coherederos pueden convertir una venta simple en meses de vueltas."],
  ["Guidance", "Orientacion"],
  ["You may be left to coordinate attorneys, advisors, and title questions alone.", "Puede quedar coordinando solo abogados, asesores y preguntas de titulo."],
  ["Professional legal counsel is coordinated when needed, with plain next steps before you decide.", "Se coordina asesoria legal profesional cuando hace falta, con pasos claros antes de decidir."],
  ["Client stories and Google reviews", "Historias de clientes y resenas de Google"],
  ["Testimonials from real HeirRight clients.", "Testimonios de clientes reales de HeirRight."],
  ["View more", "Ver mas"],
  ["Google Business Profile", "Perfil de Empresa en Google"],
  ["Public reviews from people who worked with Joshua and the team.", "Resenas publicas de personas que trabajaron con Joshua y el equipo."],
  ["Visit Google profile", "Visitar perfil de Google"],
  ["3 reviews - 3 months ago", "3 resenas - hace 3 meses"],
  [
    "I have been a Lender for Joshua and his team for about 2 years now and I have nothing but positive things to say. From the very beginning, Joshua demonstrated an exceptional level of professionalism and integrity that truly sets his company apart.",
    "He trabajado como prestamista para Joshua y su equipo durante aproximadamente 2 anos y solo tengo cosas positivas que decir. Desde el principio, Joshua demostro un nivel excepcional de profesionalismo e integridad que realmente distingue a su compania."
  ],
  [
    "The trust that I felt throughout the process was remarkable. Joshua took the time to explain every detail of the process, ensuring I fully understood the terms and conditions.",
    "La confianza que senti durante todo el proceso fue notable. Joshua se tomo el tiempo de explicar cada detalle, asegurandose de que entendiera completamente los terminos y condiciones."
  ],
  ["2 reviews - 4 months ago", "2 resenas - hace 4 meses"],
  [
    "Had to sell one of the investment properties and Joshua was able to help me to do it very fast with no hassle! Transaction was very smooth and I enjoyed working with Joshua's team.",
    "Tuve que vender una de mis propiedades de inversion y Joshua pudo ayudarme a hacerlo muy rapido y sin complicaciones. La transaccion fue muy fluida y disfrute trabajar con el equipo de Joshua."
  ],
  ["6 reviews - 3 months ago", "6 resenas - hace 3 meses"],
  [
    "Josh and his team made selling the house I inherited extremely easy. I was told I couldn't sell my house due to unsafe structures and code violations but somehow Joshua was able to purchase it and close in less than 30 days!",
    "Josh y su equipo hicieron que vender la casa que herede fuera extremadamente facil. Me dijeron que no podia venderla por estructuras inseguras y violaciones de codigo, pero de alguna manera Joshua pudo comprarla y cerrar en menos de 30 dias."
  ],
  ["6 reviews - a month ago", "6 resenas - hace un mes"],
  [
    "Joshua is very efficient and communicates the process in a way that is easy to understand. He helped my client sell their house within a few days, which was a must for their situation.",
    "Joshua es muy eficiente y comunica el proceso de una manera facil de entender. Ayudo a mi cliente a vender su casa en pocos dias, algo necesario para su situacion."
  ],
  ["About Us", "Sobre nosotros"],
  ["Family-owned, rooted in South Florida and Texas.", "Empresa familiar, con raices en el sur de Florida y Texas."],
  ["Founder, Joshua Hernandez", "Fundador, Joshua Hernandez"],
  [
    "We are a family-owned business proudly rooted in the heart of South Florida and Texas. Over eight years ago, Joshua began his real estate journey in Houston, Texas, where he successfully bought, rehabbed, and sold numerous residential properties. His work expanded into land development and, over time, a strong niche helping clients navigate inherited real estate.",
    "Somos una empresa familiar orgullosamente arraigada en el corazon del sur de Florida y Texas. Hace mas de ocho anos, Joshua comenzo su camino en bienes raices en Houston, Texas, donde compro, rehabilito y vendio numerosas propiedades residenciales. Su trabajo se expandio al desarrollo de terrenos y, con el tiempo, a un nicho fuerte ayudando a clientes a navegar propiedades heredadas."
  ],
  [
    "Joshua spearheads every transaction personally, ensuring each heir receives a custom-tailored solution. At HeirRight, we carry the heavy load so you don't have to - and stay focused on helping resolve inherited property with a clear path forward.",
    "Joshua dirige personalmente cada transaccion, asegurando que cada heredero reciba una solucion a la medida. En HeirRight llevamos la carga pesada para que usted no tenga que hacerlo, y nos enfocamos en ayudar a resolver propiedades heredadas con un camino claro."
  ],
  [
    "As a Christian-based company, we hold ourselves to a higher standard and approach every project with excellence, integrity, and a white-glove experience for our clients.",
    "Como compania basada en valores cristianos, nos exigimos un estandar mas alto y abordamos cada proyecto con excelencia, integridad y una experiencia de alto nivel para nuestros clientes."
  ],
  ["Houston roots", "Raices en Houston"],
  ["Eight-plus years of buying, rehabbing, and selling residential property.", "Mas de ocho anos comprando, rehabilitando y vendiendo propiedades residenciales."],
  ["Florida mission", "Mision en Florida"],
  ["Helping families liquidate inherited property across South Florida and Texas.", "Ayudando a familias a liquidar propiedades heredadas en el sur de Florida y Texas."],
  ["Community standard", "Compromiso comunitario"],
  ["Ten percent of profits support community service projects around South Florida.", "El diez por ciento de las ganancias apoya proyectos de servicio comunitario en el sur de Florida."],
  ["Our cash offer program", "Nuestro programa de oferta en efectivo"],
  ["Why homeowners like you sold their home to HeirRight.", "Por que propietarios como usted vendieron su casa a HeirRight."],
  ["Foreclosure", "Ejecucion hipotecaria"],
  ["Expensive Repairs", "Reparaciones costosas"],
  ["Downsizing", "Reduccion de vivienda"],
  ["Bankruptcy", "Bancarrota"],
  ["Inherited Home", "Casa heredada"],
  ["Job Loss", "Perdida de empleo"],
  ["Damage", "Danos"],
  ["Divorce", "Divorcio"],
  ["Bad Tenants", "Malos inquilinos"],
  ["Relocating", "Mudanza"],
  ["Retirement", "Jubilacion"],
  ["Health Issues", "Problemas de salud"],
  ["Plain text documents", "Documentos en texto claro"],
  ["Terms, privacy, and first-step boundaries.", "Terminos, privacidad y limites del primer paso."],
  ["Read the full Terms of Use and Privacy Policy.", "Lea los Terminos de uso y la Politica de privacidad completos."],
  [
    "The legal documents live on their own page so visitors can read them clearly without downloading anything. Website content is informational and does not create an attorney-client relationship.",
    "Los documentos legales estan en su propia pagina para que los visitantes puedan leerlos claramente sin descargar nada. El contenido del sitio web es informativo y no crea una relacion abogado-cliente."
  ],
  ["Read legal", "Leer documentos legales"],
  ["Free consultation", "Consulta gratis"],
  ["Curious to know how much your inheritance is worth?", "Quiere saber cuanto vale su herencia?"],
  [
    "You do not have to wait on every other heir to ask questions. Contact HeirRight today and we will break the process down, answer what we can, and help you decide whether a hassle-free sale makes sense.",
    "No tiene que esperar a todos los demas herederos para hacer preguntas. Contacte a HeirRight hoy y le explicaremos el proceso, responderemos lo que podamos y le ayudaremos a decidir si una venta sin complicaciones tiene sentido."
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
    "Please contact us today at 786-962-3457. We will break the process down for you, answer any questions, and if it makes sense, make it a hassle free sale.",
    "Contactenos hoy al 786-962-3457. Le explicaremos el proceso, responderemos sus preguntas y, si tiene sentido, haremos que sea una venta sin complicaciones."
  ],
  ["Submit", "Enviar"],
  ["Start a free consultation with HeirRight.", "Inicie una consulta gratis con HeirRight."],
  ["Terms of Use", "Terminos de uso"],
  ["Privacy Policy", "Politica de privacidad"],
  ["Tell us about the inherited home, liens, repairs, heirs, or timing.", "Cuentenos sobre la casa heredada, gravamenes, reparaciones, herederos o tiempos."]
]);

const attributes = new Map([
  ["HeirRight helps heirs resolve inherited property, handle legal fees, address liens and ownership disputes, and move toward a hassle-free estate settlement.", "HeirRight ayuda a herederos a resolver propiedades heredadas, manejar honorarios legales, atender gravamenes y disputas de propiedad, y avanzar hacia una solucion patrimonial sin complicaciones."],
  ["Resolve your inherited property hassle-free with HeirRight.", "Resuelva su propiedad heredada sin complicaciones con HeirRight."],
  ["HeirRight inherited property settlement", "Solucion de propiedades heredadas con HeirRight"],
  ["HeirRight start", "Inicio de HeirRight"],
  ["Primary navigation", "Navegacion principal"],
  ["Primary actions", "Acciones principales"],
  ["Consultation progress", "Progreso de la consulta"],
  ["Your profile", "Su perfil"],
  ["Property details", "Detalles de la propiedad"],
  ["Your message", "Su mensaje"],
  ["HeirRight proof points", "Puntos de confianza de HeirRight"],
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
  ["Google Business Profile review screenshots", "Capturas de resenas del Perfil de Empresa en Google"],
  ["Google Business Profile review screenshot from Daniela Armenta", "Captura de resena de Google de Daniela Armenta"],
  ["Google Business Profile review screenshots from Max Khalus, David Diaz, and Jessica Escobar-Ramos", "Capturas de resenas de Google de Max Khalus, David Diaz y Jessica Escobar-Ramos"],
  ["Joshua standing in a suit beside a family photo", "Joshua con traje junto a una foto familiar"],
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
  .replace('<meta property="og:title" content="HeirRight | Inherited Property Settlement" />', '<meta property="og:title" content="HeirRight | Solucion para propiedades heredadas" />')
  .replace('<a class="brand" href="/" aria-label="HeirRight start">', '<a class="brand" href="/es/" aria-label="HeirRight start">')
  .replace('<a href="/legal.html">Legal</a>', '<a href="/legal.html" hreflang="en">Legal</a>')
  .replace('<a class="inline-cta" href="/legal.html">', '<a class="inline-cta" href="/legal.html" hreflang="en">')
  .replace('<a href="/">\n        <img src="/assets/heirright-logo-light.svg"', '<a href="/es/">\n        <img src="/assets/heirright-logo-light.svg"')
  .replaceAll('href="/es/" lang="es" hreflang="es">Español', 'href="/" lang="en" hreflang="en">English');

html = translateAttributes(translateTextNodes(html));

await mkdir(dirname(spanishPath), { recursive: true });
await writeFile(spanishPath, html);

console.log(`Generated ${spanishPath}`);
