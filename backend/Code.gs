/**
 * AMS – Audit Management System · COA Quirino
 * Database script. It lives inside the "AMS Database" Google Sheet owned by the AMS Gmail.
 *
 * New database: fill in the two lines below, run setup() once, then Deploy → New deployment → Web app
 * (Execute as: Me · Who has access: Anyone). See SETUP.md.
 * Updating an existing database: replace this whole file, then Deploy → Manage deployments → Edit → Version: New version.
 */
const CLIENT_ID = '869592211599-236h90afenp4098m857c27ktnmqc5fq9.apps.googleusercontent.com';   // from Google Cloud → Credentials
const FIRST_ADMIN_EMAIL = 'paste.the.admin.gmail@gmail.com';               // only needed by setup() for a new database

// Core lists, then Records Management (added 19 Oct 2026). A missing sheet is made the first time it is used.
const TABLES = ['users', 'teams', 'lgus', 'rms_reports', 'rms_offices', 'rms_items', 'rms_settings'];
const ADMIN_TABLES = { users: true, teams: true, lgus: true };            // only the Admin may change these
// Who may change the Records Management lists (by role).
const TABLE_ROLES = {
  rms_reports: ['admin', 'osa'],                                  // Report Library: Admin and SA Staff
  rms_settings: ['admin', 'osa'],                                 // monitoring start, report groups
  rms_offices: ['admin', 'sa', 'atl', 'member'],                  // Office Setup
  rms_items: ['admin', 'sa', 'atl', 'member', 'osa', 'staff']     // Receiving: everyone with a role
};
const DECIDERS = ['admin', 'sa', 'atl', 'member'];                // may accept or reject (not JO or SA Staff)
const CORRECTORS = ['admin', 'sa'];                               // may correct a received record
const HEAD = ['id', 'version', 'updatedAt', 'updatedBy', 'deleted', 'data'];
const SEED = {"teams":[{"id":"team-1","name":"Team 1","officeCode":"","atlUserId":"","saUserId":"","history":[]},{"id":"team-2","name":"Team 2","officeCode":"R2-02","atlUserId":"","saUserId":"","history":[]}],"lgus":[{"id":"lgu-quirino","kind":"province","name":"Quirino","parentId":"","teamId":"team-1","active":true},{"id":"lgu-aglipay","kind":"municipality","name":"Aglipay","parentId":"lgu-quirino","teamId":"team-2","active":true},{"id":"brgy-aglipay-alicia","kind":"barangay","name":"Alicia","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-001","hasSk":true,"active":true},{"id":"brgy-aglipay-cabugao","kind":"barangay","name":"Cabugao","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-002","hasSk":true,"active":true},{"id":"brgy-aglipay-dagupan","kind":"barangay","name":"Dagupan","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-003","hasSk":true,"active":true},{"id":"brgy-aglipay-diodol","kind":"barangay","name":"Diodol","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-004","hasSk":true,"active":true},{"id":"brgy-aglipay-dumabel","kind":"barangay","name":"Dumabel","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-005","hasSk":true,"active":true},{"id":"brgy-aglipay-dungo","kind":"barangay","name":"Dungo","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-006","hasSk":true,"active":true},{"id":"brgy-aglipay-guinalbin","kind":"barangay","name":"Guinalbin","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-007","hasSk":true,"active":true},{"id":"brgy-aglipay-ligaya","kind":"barangay","name":"Ligaya","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-008","hasSk":true,"active":true},{"id":"brgy-aglipay-nagabgaban","kind":"barangay","name":"Nagabgaban","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-009","hasSk":true,"active":true},{"id":"brgy-aglipay-palacian","kind":"barangay","name":"Palacian","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-010","hasSk":true,"active":true},{"id":"brgy-aglipay-pinaripad-norte","kind":"barangay","name":"Pinaripad Norte","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-011","hasSk":true,"active":true},{"id":"brgy-aglipay-pinaripad-sur","kind":"barangay","name":"Pinaripad Sur","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-012","hasSk":true,"active":true},{"id":"brgy-aglipay-progreso","kind":"barangay","name":"Progreso","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-013","hasSk":true,"active":true},{"id":"brgy-aglipay-ramos","kind":"barangay","name":"Ramos","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-014","hasSk":true,"active":true},{"id":"brgy-aglipay-rang-ayan","kind":"barangay","name":"Rang-ayan","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-015","hasSk":true,"active":true},{"id":"brgy-aglipay-san-antonio","kind":"barangay","name":"San Antonio","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-016","hasSk":true,"active":true},{"id":"brgy-aglipay-san-benigno","kind":"barangay","name":"San Benigno","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-017","hasSk":true,"active":true},{"id":"brgy-aglipay-san-francisco","kind":"barangay","name":"San Francisco","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-018","hasSk":true,"active":true},{"id":"brgy-aglipay-san-leonardo","kind":"barangay","name":"San Leonardo","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-019","hasSk":true,"active":true},{"id":"brgy-aglipay-san-manuel","kind":"barangay","name":"San Manuel","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-020","hasSk":true,"active":true},{"id":"brgy-aglipay-san-ramon","kind":"barangay","name":"San Ramon","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-021","hasSk":true,"active":true},{"id":"brgy-aglipay-victoria","kind":"barangay","name":"Victoria","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-022","hasSk":true,"active":true},{"id":"brgy-aglipay-villa-pagaduan","kind":"barangay","name":"Villa Pagaduan","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-023","hasSk":true,"active":true},{"id":"brgy-aglipay-villa-santiago","kind":"barangay","name":"Villa Santiago","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-024","hasSk":true,"active":true},{"id":"brgy-aglipay-villa-ventura","kind":"barangay","name":"Villa Ventura","formerName":"","parentId":"lgu-aglipay","teamId":"team-2","code":"BRGY-025","hasSk":true,"active":true},{"id":"lgu-cabarroguis","kind":"municipality","name":"Cabarroguis","parentId":"lgu-quirino","teamId":"team-2","active":true},{"id":"brgy-cabarroguis-banuar","kind":"barangay","name":"Banuar","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-001","hasSk":true,"active":true},{"id":"brgy-cabarroguis-burgos","kind":"barangay","name":"Burgos","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-002","hasSk":true,"active":true},{"id":"brgy-cabarroguis-calaocan","kind":"barangay","name":"Calaocan","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-003","hasSk":true,"active":true},{"id":"brgy-cabarroguis-del-pilar","kind":"barangay","name":"Del Pilar","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-004","hasSk":true,"active":true},{"id":"brgy-cabarroguis-dibibi","kind":"barangay","name":"Dibibi","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-005","hasSk":true,"active":true},{"id":"brgy-cabarroguis-dingasan","kind":"barangay","name":"Dingasan","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-006","hasSk":true,"active":true},{"id":"brgy-cabarroguis-eden","kind":"barangay","name":"Eden","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-007","hasSk":true,"active":true},{"id":"brgy-cabarroguis-gomez","kind":"barangay","name":"Gomez","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-008","hasSk":true,"active":true},{"id":"brgy-cabarroguis-gundaway","kind":"barangay","name":"Gundaway","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-009","hasSk":true,"active":true},{"id":"brgy-cabarroguis-mangandingay","kind":"barangay","name":"Mangandingay","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-010","hasSk":true,"active":true},{"id":"brgy-cabarroguis-san-marcos","kind":"barangay","name":"San Marcos","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-011","hasSk":true,"active":true},{"id":"brgy-cabarroguis-santo-domingo","kind":"barangay","name":"Santo Domingo","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-012","hasSk":true,"active":true},{"id":"brgy-cabarroguis-tucod","kind":"barangay","name":"Tucod","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-013","hasSk":true,"active":true},{"id":"brgy-cabarroguis-villa-pena","kind":"barangay","name":"Villa Peña","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-014","hasSk":true,"active":true},{"id":"brgy-cabarroguis-villamor","kind":"barangay","name":"Villamor","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-015","hasSk":true,"active":true},{"id":"brgy-cabarroguis-villarose","kind":"barangay","name":"Villarose","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-016","hasSk":true,"active":true},{"id":"brgy-cabarroguis-zamora","kind":"barangay","name":"Zamora","formerName":"","parentId":"lgu-cabarroguis","teamId":"team-2","code":"BRGY-017","hasSk":true,"active":true},{"id":"lgu-diffun","kind":"municipality","name":"Diffun","parentId":"lgu-quirino","teamId":"team-1","active":true},{"id":"brgy-diffun-aklan-village","kind":"barangay","name":"Aklan Village","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-001","hasSk":true,"active":true},{"id":"brgy-diffun-andres-bonifacio","kind":"barangay","name":"Andres Bonifacio","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-002","hasSk":true,"active":true},{"id":"brgy-diffun-aurora-east","kind":"barangay","name":"Aurora East","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-003","hasSk":true,"active":true},{"id":"brgy-diffun-aurora-west","kind":"barangay","name":"Aurora West","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-004","hasSk":true,"active":true},{"id":"brgy-diffun-baguio-village","kind":"barangay","name":"Baguio Village","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-005","hasSk":true,"active":true},{"id":"brgy-diffun-balagbag","kind":"barangay","name":"Balagbag","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-006","hasSk":true,"active":true},{"id":"brgy-diffun-bannawag","kind":"barangay","name":"Bannawag","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-007","hasSk":true,"active":true},{"id":"brgy-diffun-cajel","kind":"barangay","name":"Cajel","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-008","hasSk":true,"active":true},{"id":"brgy-diffun-campamento","kind":"barangay","name":"Campamento","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-009","hasSk":true,"active":true},{"id":"brgy-diffun-diego-silang","kind":"barangay","name":"Diego Silang","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-010","hasSk":true,"active":true},{"id":"brgy-diffun-don-faustino-pagaduan","kind":"barangay","name":"Don Faustino Pagaduan","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-011","hasSk":true,"active":true},{"id":"brgy-diffun-don-mariano-perez-sr","kind":"barangay","name":"Don Mariano Perez Sr.","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-012","hasSk":true,"active":true},{"id":"brgy-diffun-dona-imelda","kind":"barangay","name":"Doña Imelda","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-013","hasSk":true,"active":true},{"id":"brgy-diffun-dumanisi","kind":"barangay","name":"Dumanisi","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-014","hasSk":true,"active":true},{"id":"brgy-diffun-gabriela-silang","kind":"barangay","name":"Gabriela Silang","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-015","hasSk":true,"active":true},{"id":"brgy-diffun-gregorio-pimentel","kind":"barangay","name":"Gregorio Pimentel","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-016","hasSk":true,"active":true},{"id":"brgy-diffun-gulac","kind":"barangay","name":"Gulac","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-017","hasSk":true,"active":true},{"id":"brgy-diffun-guribang","kind":"barangay","name":"Guribang","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-018","hasSk":true,"active":true},{"id":"brgy-diffun-ifugao-village","kind":"barangay","name":"Ifugao Village","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-019","hasSk":true,"active":true},{"id":"brgy-diffun-isidro-paredes","kind":"barangay","name":"Isidro Paredes","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-020","hasSk":true,"active":true},{"id":"brgy-diffun-liwayway","kind":"barangay","name":"Liwayway","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-021","hasSk":true,"active":true},{"id":"brgy-diffun-luttuad","kind":"barangay","name":"Luttuad","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-022","hasSk":true,"active":true},{"id":"brgy-diffun-magsaysay","kind":"barangay","name":"Magsaysay","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-023","hasSk":true,"active":true},{"id":"brgy-diffun-makate","kind":"barangay","name":"Makate","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-024","hasSk":true,"active":true},{"id":"brgy-diffun-maria-clara","kind":"barangay","name":"Maria Clara","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-025","hasSk":true,"active":true},{"id":"brgy-diffun-rafael-palma","kind":"barangay","name":"Rafael Palma","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-026","hasSk":true,"active":true},{"id":"brgy-diffun-ricarte-norte","kind":"barangay","name":"Ricarte Norte","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-027","hasSk":true,"active":true},{"id":"brgy-diffun-ricarte-sur","kind":"barangay","name":"Ricarte Sur","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-028","hasSk":true,"active":true},{"id":"brgy-diffun-rizal","kind":"barangay","name":"Rizal","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-029","hasSk":true,"active":true},{"id":"brgy-diffun-san-antonio","kind":"barangay","name":"San Antonio","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-030","hasSk":true,"active":true},{"id":"brgy-diffun-san-isidro","kind":"barangay","name":"San Isidro","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-031","hasSk":true,"active":true},{"id":"brgy-diffun-san-pascual","kind":"barangay","name":"San Pascual","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-032","hasSk":true,"active":true},{"id":"brgy-diffun-villa-pascua","kind":"barangay","name":"Villa Pascua","formerName":"","parentId":"lgu-diffun","teamId":"team-1","code":"BRGY-033","hasSk":true,"active":true},{"id":"lgu-maddela","kind":"municipality","name":"Maddela","parentId":"lgu-quirino","teamId":"team-2","active":true},{"id":"brgy-maddela-abbag","kind":"barangay","name":"Abbag","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-001","hasSk":true,"active":true},{"id":"brgy-maddela-balligui","kind":"barangay","name":"Balligui","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-002","hasSk":true,"active":true},{"id":"brgy-maddela-buenavista","kind":"barangay","name":"Buenavista","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-003","hasSk":true,"active":true},{"id":"brgy-maddela-cabaruan","kind":"barangay","name":"Cabaruan","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-004","hasSk":true,"active":true},{"id":"brgy-maddela-cabua-an","kind":"barangay","name":"Cabua-an","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-005","hasSk":true,"active":true},{"id":"brgy-maddela-cofcaville","kind":"barangay","name":"Cofcaville","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-006","hasSk":true,"active":true},{"id":"brgy-maddela-diduyon","kind":"barangay","name":"Diduyon","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-007","hasSk":true,"active":true},{"id":"brgy-maddela-dipintin","kind":"barangay","name":"Dipintin","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-008","hasSk":true,"active":true},{"id":"brgy-maddela-divisoria-norte","kind":"barangay","name":"Divisoria Norte","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-009","hasSk":true,"active":true},{"id":"brgy-maddela-divisoria-sur","kind":"barangay","name":"Divisoria Sur","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-010","hasSk":true,"active":true},{"id":"brgy-maddela-dumabato-norte","kind":"barangay","name":"Dumabato Norte","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-011","hasSk":true,"active":true},{"id":"brgy-maddela-dumabato-sur","kind":"barangay","name":"Dumabato Sur","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-012","hasSk":true,"active":true},{"id":"brgy-maddela-jose-ancheta","kind":"barangay","name":"Jose Ancheta","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-013","hasSk":true,"active":true},{"id":"brgy-maddela-lusod","kind":"barangay","name":"Lusod","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-014","hasSk":true,"active":true},{"id":"brgy-maddela-manglad","kind":"barangay","name":"Manglad","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-015","hasSk":true,"active":true},{"id":"brgy-maddela-pedlisan","kind":"barangay","name":"Pedlisan","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-016","hasSk":true,"active":true},{"id":"brgy-maddela-poblacion-norte","kind":"barangay","name":"Poblacion Norte","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-017","hasSk":true,"active":true},{"id":"brgy-maddela-poblacion-sur","kind":"barangay","name":"Poblacion Sur","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-018","hasSk":true,"active":true},{"id":"brgy-maddela-san-bernabe","kind":"barangay","name":"San Bernabe","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-019","hasSk":true,"active":true},{"id":"brgy-maddela-san-dionisio-i","kind":"barangay","name":"San Dionisio I","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-020","hasSk":true,"active":true},{"id":"brgy-maddela-san-martin","kind":"barangay","name":"San Martin","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-021","hasSk":true,"active":true},{"id":"brgy-maddela-san-pedro","kind":"barangay","name":"San Pedro","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-022","hasSk":true,"active":true},{"id":"brgy-maddela-san-salvador","kind":"barangay","name":"San Salvador","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-023","hasSk":true,"active":true},{"id":"brgy-maddela-santa-maria","kind":"barangay","name":"Santa Maria","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-024","hasSk":true,"active":true},{"id":"brgy-maddela-santo-nino","kind":"barangay","name":"Santo Niño","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-025","hasSk":true,"active":true},{"id":"brgy-maddela-santo-tomas","kind":"barangay","name":"Santo Tomas","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-026","hasSk":true,"active":true},{"id":"brgy-maddela-villa-agullana","kind":"barangay","name":"Villa Agullana","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-027","hasSk":true,"active":true},{"id":"brgy-maddela-villa-gracia","kind":"barangay","name":"Villa Gracia","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-028","hasSk":true,"active":true},{"id":"brgy-maddela-villa-hermosa-norte","kind":"barangay","name":"Villa Hermosa Norte","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-029","hasSk":true,"active":true},{"id":"brgy-maddela-villa-hermosa-sur","kind":"barangay","name":"Villa Hermosa Sur","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-030","hasSk":true,"active":true},{"id":"brgy-maddela-villa-jose-v-ylanan","kind":"barangay","name":"Villa Jose V Ylanan","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-031","hasSk":true,"active":true},{"id":"brgy-maddela-ysmael","kind":"barangay","name":"Ysmael","formerName":"","parentId":"lgu-maddela","teamId":"team-2","code":"BRGY-032","hasSk":true,"active":true},{"id":"lgu-nagtipunan","kind":"municipality","name":"Nagtipunan","parentId":"lgu-quirino","teamId":"team-2","active":true},{"id":"brgy-nagtipunan-anak","kind":"barangay","name":"Anak","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-001","hasSk":true,"active":true},{"id":"brgy-nagtipunan-asaklat","kind":"barangay","name":"Asaklat","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-002","hasSk":true,"active":true},{"id":"brgy-nagtipunan-dipantan","kind":"barangay","name":"Dipantan","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-003","hasSk":true,"active":true},{"id":"brgy-nagtipunan-dissimungal","kind":"barangay","name":"Dissimungal","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-004","hasSk":true,"active":true},{"id":"brgy-nagtipunan-guino","kind":"barangay","name":"Guino","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-005","hasSk":true,"active":true},{"id":"brgy-nagtipunan-la-conwap","kind":"barangay","name":"La Conwap","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-006","hasSk":true,"active":true},{"id":"brgy-nagtipunan-landingan","kind":"barangay","name":"Landingan","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-007","hasSk":true,"active":true},{"id":"brgy-nagtipunan-mataddi","kind":"barangay","name":"Mataddi","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-008","hasSk":true,"active":true},{"id":"brgy-nagtipunan-matmad","kind":"barangay","name":"Matmad","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-009","hasSk":true,"active":true},{"id":"brgy-nagtipunan-old-gumiad","kind":"barangay","name":"Keat","formerName":"Old Gumiad","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-010","hasSk":true,"active":true},{"id":"brgy-nagtipunan-ponggo","kind":"barangay","name":"Ponggo","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-011","hasSk":true,"active":true},{"id":"brgy-nagtipunan-san-dionisio-ii","kind":"barangay","name":"San Dionisio II","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-012","hasSk":true,"active":true},{"id":"brgy-nagtipunan-san-pugo","kind":"barangay","name":"San Pugo","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-013","hasSk":true,"active":true},{"id":"brgy-nagtipunan-san-ramos","kind":"barangay","name":"San Ramos","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-014","hasSk":true,"active":true},{"id":"brgy-nagtipunan-sangbay","kind":"barangay","name":"Sangbay","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-015","hasSk":true,"active":true},{"id":"brgy-nagtipunan-wasid","kind":"barangay","name":"Wasid","formerName":"","parentId":"lgu-nagtipunan","teamId":"team-2","code":"BRGY-016","hasSk":true,"active":true},{"id":"lgu-saguday","kind":"municipality","name":"Saguday","parentId":"lgu-quirino","teamId":"team-2","active":true},{"id":"brgy-saguday-cardenas","kind":"barangay","name":"Cardenas","formerName":"","parentId":"lgu-saguday","teamId":"team-2","code":"BRGY-001","hasSk":true,"active":true},{"id":"brgy-saguday-dibul","kind":"barangay","name":"Dibul","formerName":"","parentId":"lgu-saguday","teamId":"team-2","code":"BRGY-002","hasSk":true,"active":true},{"id":"brgy-saguday-gamis","kind":"barangay","name":"Gamis","formerName":"","parentId":"lgu-saguday","teamId":"team-2","code":"BRGY-003","hasSk":true,"active":true},{"id":"brgy-saguday-la-paz","kind":"barangay","name":"La Paz","formerName":"","parentId":"lgu-saguday","teamId":"team-2","code":"BRGY-004","hasSk":true,"active":true},{"id":"brgy-saguday-magsaysay","kind":"barangay","name":"Magsaysay","formerName":"","parentId":"lgu-saguday","teamId":"team-2","code":"BRGY-005","hasSk":true,"active":true},{"id":"brgy-saguday-rizal","kind":"barangay","name":"Rizal","formerName":"","parentId":"lgu-saguday","teamId":"team-2","code":"BRGY-006","hasSk":true,"active":true},{"id":"brgy-saguday-salvacion","kind":"barangay","name":"Salvacion","formerName":"","parentId":"lgu-saguday","teamId":"team-2","code":"BRGY-007","hasSk":true,"active":true},{"id":"brgy-saguday-santo-tomas","kind":"barangay","name":"Santo Tomas","formerName":"","parentId":"lgu-saguday","teamId":"team-2","code":"BRGY-008","hasSk":true,"active":true},{"id":"brgy-saguday-tres-reyes","kind":"barangay","name":"Tres Reyes","formerName":"","parentId":"lgu-saguday","teamId":"team-2","code":"BRGY-009","hasSk":true,"active":true}]};

/* ---------- one-time setup ---------- */
function setup() {
  if (CLIENT_ID.indexOf('PASTE') === 0 || CLIENT_ID.indexOf('__') === 0 || FIRST_ADMIN_EMAIL.indexOf('paste') === 0) throw new Error('Fill in CLIENT_ID and FIRST_ADMIN_EMAIL at the top first.');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  TABLES.concat(['log']).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(name === 'log' ? ['at', 'by', 'action', 'table', 'id'] : HEAD);
      sh.setFrozenRows(1);
    }
  });
  const first = ss.getSheetByName('Sheet1'); if (first && ss.getSheets().length > 1 && first.getLastRow() === 0) ss.deleteSheet(first);
  const now = new Date().toISOString();
  const add = function (table, id, rec) { if (!findRow_(table, id)) sheet_(table).appendRow([id, 1, now, 'setup', false, JSON.stringify(rec)]); };
  SEED.teams.forEach(function (t) { add('teams', t.id, t); });
  SEED.lgus.forEach(function (l) { add('lgus', l.id, l); });
  const email = FIRST_ADMIN_EMAIL.trim().toLowerCase();
  const users = readAll_('users');
  if (!users.some(function (u) { return String(u.data.email).toLowerCase() === email; })) {
    add('users', 'user-first-admin', { email: email, name: 'ADMIN', nickname: '', position: '', designation: '', roles: ['admin'], teamIds: [], munIds: [], status: 'active' });
  }
  SpreadsheetApp.flush();
  Logger.log('AMS setup done: ' + SEED.teams.length + ' teams, ' + SEED.lgus.length + ' LGUs, first Admin ' + email);
}

/* ---------- web app ---------- */
function doGet() { return json_({ ok: true, app: 'AMS', time: new Date().toISOString() }); }

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const email = verify_(req.idToken);
    const me = readAll_('users').filter(function (u) { return !u.deleted && String(u.data.email).toLowerCase() === email; })[0];
    if (!me || me.data.status === 'disabled') throw new Error('This Gmail (' + email + ') is not registered in AMS. Ask the Admin to add it.');
    if (me.data.status === 'invited') markActive_(me, email);
    const roles = me.data.roles || [];
    if (req.action === 'pull') return json_({ ok: true, records: pull_(req.since), serverTime: new Date().toISOString() });
    if (req.action === 'push') return json_({ ok: true, results: push_(req.changes || [], email, roles) });
    throw new Error('Unknown action');
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

/* ---------- sign-in check ---------- */
function verify_(token) {
  if (!token) throw new Error('SIGNIN_NEEDED');
  const cache = CacheService.getScriptCache();
  const key = 't' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)).slice(0, 40);
  const hit = cache.get(key); if (hit) return hit;
  const res = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(token), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('SIGNIN_NEEDED');
  const info = JSON.parse(res.getContentText());
  if (info.aud !== CLIENT_ID) throw new Error('This sign-in is not for this app.');
  if (String(info.email_verified) !== 'true') throw new Error('This Gmail is not verified by Google.');
  const email = String(info.email).toLowerCase();
  const left = Math.min(3000, Math.max(60, Number(info.exp) - Math.floor(Date.now() / 1000) - 60));
  cache.put(key, email, left);
  return email;
}

/* ---------- read and write ---------- */
function sheet_(table) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(table);
  if (!sh && TABLES.indexOf(table) >= 0) { sh = ss.insertSheet(table); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}

function readAll_(table) {
  const sh = sheet_(table); const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, Math.max(HEAD.length, sh.getLastColumn())).getValues().filter(function (r) { return r[0]; }).map(rec_);
}
// A Google Sheets cell holds at most 50,000 characters. A large record (e.g. a BRS with 76 bank accounts) is split into
// pieces of up to 45,000 characters in the cells to the right of "data"; the extra pieces start with "~" so that Sheets
// never turns a piece into a number or a date.
const PIECE = 45000;
function rowOf_(id, version, at, by, deleted, data) {
  const s = JSON.stringify(data), row = [id, version, at, by, deleted];
  for (let i = 0; i === 0 || i * PIECE < s.length; i++) row.push((i ? '~' : '') + s.slice(i * PIECE, (i + 1) * PIECE));
  return row;
}
function writeRow_(sh, rowNo, values) {
  const w = Math.max(values.length, sh.getLastColumn(), HEAD.length);
  if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
  const full = values.concat(new Array(w - values.length).fill(''));
  if (rowNo) sh.getRange(rowNo, 1, 1, w).setValues([full]); else sh.appendRow(full);
}
function rec_(r) {
  const text = r.slice(5).filter(function (x) { return x !== '' && x !== null && x !== undefined; }).map(function (x, i) { return i ? String(x).replace(/^~/, '') : String(x); }).join('');
  let data = null; try { data = JSON.parse(text); } catch (e) { data = null; }
  const at = r[2] instanceof Date ? r[2].toISOString() : String(r[2]);
  return { id: String(r[0]), version: Number(r[1]) || 0, updatedAt: at, updatedBy: String(r[3]), deleted: r[4] === true || r[4] === 'TRUE', data: data };
}
function findRow_(table, id) {
  const sh = sheet_(table); const n = sh.getLastRow();
  if (n < 2) return 0;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return 0;
}

function pull_(since) {
  const out = {};
  TABLES.forEach(function (t) { out[t] = readAll_(t).filter(function (r) { return !since || r.updatedAt > since; }); });
  return out;
}

function push_(changes, email, roles) {
  const isAdmin = roles.indexOf('admin') >= 0;
  const has = function (list) { return roles.some(function (r) { return list.indexOf(r) >= 0; }); };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const log = sheet_('log');
    return changes.map(function (c) {
      const res = { table: c.table, id: c.id };
      try {
        if (TABLES.indexOf(c.table) < 0) throw new Error('Unknown list: ' + c.table);
        if (ADMIN_TABLES[c.table] && !isAdmin) throw new Error('Only the Admin can change ' + c.table + '.');
        if (TABLE_ROLES[c.table] && !has(TABLE_ROLES[c.table])) throw new Error('Your role cannot change this (' + c.table + ').');
        const row = findRow_(c.table, c.id), sh = sheet_(c.table);
        const cur = row ? rec_(sh.getRange(row, 1, 1, Math.max(HEAD.length, sh.getLastColumn())).getValues()[0]) : null;
        if ((cur ? cur.version : 0) !== Number(c.baseVersion || 0)) { res.status = 'conflict'; res.record = cur; return res; }
        if (c.table === 'users' && !c.deleted) checkUser_(c, email);
        if (c.table === 'rms_items') checkItem_(c, cur, has(DECIDERS), isAdmin, has(CORRECTORS));
        const next = rowOf_(c.id, (cur ? cur.version : 0) + 1, new Date().toISOString(), email, !!c.deleted, c.data);
        writeRow_(sh, row, next);
        log.appendRow([next[2], email, row ? (c.deleted ? 'deleted' : 'changed') : 'added', c.table, c.id]);
        res.status = 'ok'; res.record = rec_(next);
      } catch (err) { res.status = 'error'; res.error = String(err.message || err); }
      return res;
    });
  } finally { lock.releaseLock(); }
}

/* ---------- Records Management: receiving ---------- */
// Tracking numbers are given here, so two people receiving at the same time never get the same number.
// One running series per office per year: MAD-ABB-RCI-2026-0012 (reports), MAD-ABB-2026-0013 (communications), OUT-2026-0004.
// Once given, a record's number never changes. Only auditors may accept or reject.
function checkItem_(c, cur, decider, isAdmin, corrector) {
  if (c.deleted && !isAdmin) throw new Error('Only the Admin can delete a received item.');
  const d = c.data || {}, old = cur && cur.data ? cur.data : null;
  // Corrections (date received, period, names, unticking a document) are for the Admin and the SA only.
  if (old && !corrector) {
    const same = function (k) { return JSON.stringify(d[k] === undefined ? null : d[k]) === JSON.stringify(old[k] === undefined ? null : old[k]); };
    const unticked = (old.checklist || []).some(function (x, k) { return x.ok && !((d.checklist || [])[k] || {}).ok; });
    if (!same('corrections') || !same('receivedAt') || !same('period') || !same('submittedBy') || !same('submittedDesignation') || !same('subject') || unticked)
      throw new Error('Only the Admin or the SA can correct a received record.');
  }
  const decided = function (x) { return x && x.decision ? JSON.stringify(x.decision) : ''; };
  if (!decider && (decided(d) !== decided(old) || ((d.status === 'accepted' || d.status === 'rejected') && (!old || old.status !== d.status))))
    throw new Error('Only an auditor (ATL, Team Member, SA or Admin) can accept or reject.');
  if (old && old.trackingNo) { d.trackingNo = old.trackingNo; d.series = old.series; d.trackingYear = old.trackingYear; d.seriesKey = old.seriesKey; return; }
  if (!d.trackingNo) return;
  const year = Number(d.trackingYear) || new Date().getFullYear(), key = d.seriesKey || d.officeId;
  let n = 0;
  readAll_('rms_items').forEach(function (r) {
    const x = r.data || {};
    if (r.id !== c.id && x.trackingNo && (x.seriesKey || x.officeId) === key && Number(x.trackingYear) === year) n = Math.max(n, Number(x.series) || 0);
  });
  const code = key === 'outside' ? 'OUT' : d.officeCode;
  d.series = n + 1; d.trackingYear = year; d.seriesKey = key;
  d.trackingNo = [code, d.kind === 'comm' ? '' : d.reportCode, year, ('000' + d.series).slice(-4)].filter(function (v) { return v !== '' && v !== undefined && v !== null; }).join('-');
}

// Same Gmail twice is not allowed; the Admin cannot remove their own Admin access.
function checkUser_(c, email) {
  const mail = String(c.data.email || '').toLowerCase();
  const dup = readAll_('users').some(function (u) { return u.id !== c.id && !u.deleted && String(u.data.email).toLowerCase() === mail; });
  if (dup) throw new Error('That Gmail is already registered.');
  if (mail === email && ((c.data.roles || []).indexOf('admin') < 0 || c.data.status === 'disabled')) throw new Error('You cannot remove your own Admin access.');
}

// First sign-in: Invited becomes Active.
function markActive_(me, email) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const row = findRow_('users', me.id); if (!row) return;
    const data = Object.assign({}, me.data, { status: 'active' });
    writeRow_(sheet_('users'), row, rowOf_(me.id, me.version + 1, new Date().toISOString(), email, false, data));
  } finally { lock.releaseLock(); }
}

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
