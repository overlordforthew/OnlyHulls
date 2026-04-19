export interface TopLocationMarket {
  slug: string;
  label: string;
  aliases: string[];
  searchTerms: string[];
  hubHref?: string;
  country?: string;
  region?: string;
  parentSlugs?: string[];
}

export type LocationConfidence = "unknown" | "region" | "city" | "exact";

export interface LocationMarketSignals {
  marketSlugs: string[];
  country: string | null;
  region: string | null;
  confidence: LocationConfidence;
  approximate: boolean;
}

export const TOP_LOCATION_MARKETS: TopLocationMarket[] = [
  {
    slug: "united-states",
    label: "United States",
    country: "United States",
    region: "United States",
    aliases: ["usa", "u.s.", "u.s.a.", "united states of america"],
    searchTerms: ["united states", "usa", "u.s.", "u.s.a.", "united states of america"],
  },
  {
    slug: "florida",
    label: "Florida",
    hubHref: "/boats/location/florida",
    country: "United States",
    region: "Florida",
    parentSlugs: ["united-states"],
    aliases: ["fl", "fort lauderdale", "ft lauderdale", "miami", "key west", "stuart", "marathon", "st augustine", "saint augustine", "boca raton", "deerfield beach", "tampa"],
    searchTerms: ["florida", "fort lauderdale", "ft lauderdale", "miami", "key west", "stuart", "marathon", "st augustine", "saint augustine", "boca raton", "deerfield beach", "tampa"],
  },
  {
    slug: "bahamas",
    label: "Bahamas",
    hubHref: "/boats/location/bahamas",
    country: "Bahamas",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["the bahamas", "nassau", "abaco", "exuma", "george town"],
    searchTerms: ["bahamas", "nassau", "abaco", "exuma", "george town"],
  },
  {
    slug: "puerto-rico",
    label: "Puerto Rico",
    hubHref: "/boats/location/puerto-rico",
    country: "Puerto Rico",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["pr", "san juan", "fajardo", "culebra", "vieques"],
    searchTerms: ["puerto rico", "san juan", "fajardo", "culebra", "vieques"],
  },
  {
    slug: "caribbean",
    label: "Caribbean",
    hubHref: "/boats/location/caribbean",
    region: "Caribbean",
    aliases: ["west indies", "virgin islands"],
    searchTerms: [
      "caribbean",
      "bahamas",
      "puerto rico",
      "virgin islands",
      "bvi",
      "usvi",
      "tortola",
      "grenada",
      "antigua",
      "st martin",
      "saint martin",
      "st. maarten",
      "martinique",
      "st thomas",
      "saint thomas",
      "trinidad",
      "barbados",
      "martinique",
      "le marin",
      "grenada",
      "saint lucia",
      "st lucia",
      "dominican republic",
      "guadeloupe",
      "st maarten",
      "saint martin",
      "dutch antilles",
      "roatan",
    ],
  },
  {
    slug: "bvi",
    label: "BVI",
    country: "British Virgin Islands",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["british virgin islands", "british virgin island", "tortola", "manuel reef", "nanny cay", "road town", "virgin gorda"],
    searchTerms: ["bvi", "british virgin islands", "british virgin island", "tortola", "manuel reef", "nanny cay", "road town", "virgin gorda"],
  },
  {
    slug: "usvi",
    label: "USVI",
    country: "United States Virgin Islands",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["us virgin islands", "u.s. virgin islands", "st thomas", "st. thomas", "st john", "st croix", "saint croix", "christiansted"],
    searchTerms: ["usvi", "us virgin islands", "u.s. virgin islands", "st thomas", "st. thomas", "st john", "st croix", "saint croix", "christiansted"],
  },
  {
    slug: "mediterranean",
    label: "Mediterranean",
    region: "Mediterranean",
    aliases: ["med"],
    searchTerms: [
      "mediterranean",
      "mallorca",
      "sardinia",
      "balearics",
      "ionian",
      "aegean",
      "greece",
      "spain",
      "france",
      "italy",
      "croatia",
      "turkey",
      "malta",
      "cyprus",
      "slovenia",
      "monaco",
      "adriatic sea",
      "gibraltar",
      "tunisia",
    ],
  },
  {
    slug: "greece",
    label: "Greece",
    country: "Greece",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["greek islands", "lefkada", "lefkas", "athens", "attica", "alimos", "elliniko", "preveza", "corfu", "kos", "agios nikolaos", "chios", "corinth", "corinth gr", "crete", "peloponnese", "peloponesse", "rhodes", "saronic gulf", "attika saronic gulf", "ionian", "aegean"],
    searchTerms: ["greece", "greek islands", "lefkada", "lefkas", "athens", "attica", "alimos", "elliniko", "preveza", "corfu", "kos", "agios nikolaos", "chios", "corinth", "corinth gr", "crete", "peloponnese", "peloponesse", "rhodes", "saronic gulf", "attika saronic gulf", "ionian", "aegean"],
  },
  {
    slug: "spain",
    label: "Spain",
    country: "Spain",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["espagne", "mallorca", "palma", "balearics", "balearic islands", "canary islands", "barcelona", "catalonia", "alicante", "valencia", "valencian community", "tarragona", "badalona", "andalusia", "sotogrande", "murcia", "cartagena", "denia", "a coruna", "a Coruña", "galicia"],
    searchTerms: ["spain", "espagne", "mallorca", "palma", "balearics", "balearic islands", "canary islands", "barcelona", "catalonia", "alicante", "valencia", "valencian community", "tarragona", "badalona", "andalusia", "sotogrande", "murcia", "cartagena", "denia", "a coruna", "a Coruña", "galicia"],
  },
  {
    slug: "france",
    label: "France",
    country: "France",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["la rochelle", "marseille", "lorient", "canet-en-roussillon", "french riviera", "martigues", "sete", "sète", "toulon", "antibes", "perpignan", "cannes", "cap d'agde", "cogolin", "corsica", "ajaccio", "cote d'azur", "côte d'azur", "golfe juan", "gruissan", "les herbiers", "nice", "port pin rolland", "rochefort", "saint-malo", "saint malo", "saint-tropez", "saint tropez", "saint-raphael", "saint raphael", "beaulieu sur mer", "beaulieu-sur-mer"],
    searchTerms: ["france", "la rochelle", "marseille", "lorient", "canet-en-roussillon", "french riviera", "martigues", "sete", "sète", "toulon", "antibes", "perpignan", "cannes", "cap d'agde", "cogolin", "corsica", "ajaccio", "cote d'azur", "côte d'azur", "golfe juan", "gruissan", "les herbiers", "nice", "port pin rolland", "rochefort", "saint-malo", "saint malo", "saint-tropez", "saint tropez", "saint-raphael", "saint raphael", "beaulieu sur mer", "beaulieu-sur-mer"],
  },
  {
    slug: "italy",
    label: "Italy",
    country: "Italy",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["italie", "abruzzo", "sardinia", "sardegna", "sicily", "sicilia", "olbia", "tuscany", "toscana", "liguria", "ancona", "marche", "genoa", "genova", "fiumicino", "civitavecchia", "crotone", "emilia romagna", "friuli venezia giulia", "gaeta", "imperia", "la spezia", "campania", "caorle", "loano", "monfalcone", "rimini", "rosignano marittimo", "portovenere", "rome", "roma", "lazio", "sanremo", "venezia", "venice", "aprilia marittima", "arbatax", "argentario", "tyrrhenian sea", "mar tirreno", "mare adriatico"],
    searchTerms: ["italy", "italie", "abruzzo", "sardinia", "sardegna", "sicily", "sicilia", "olbia", "tuscany", "toscana", "liguria", "ancona", "marche", "genoa", "genova", "fiumicino", "civitavecchia", "crotone", "emilia romagna", "friuli venezia giulia", "gaeta", "imperia", "la spezia", "campania", "caorle", "loano", "monfalcone", "rimini", "rosignano marittimo", "portovenere", "rome", "roma", "lazio", "sanremo", "venezia", "venice", "aprilia marittima", "arbatax", "argentario", "tyrrhenian sea", "mar tirreno", "mare adriatico"],
  },
  {
    slug: "croatia",
    label: "Croatia",
    country: "Croatia",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["hrvatska", "split", "sibenik", "šibenik", "zadar", "pula", "trogir", "sukosan", "sukošan", "dubrovnik", "dalmatia", "biograd", "biograd na moru", "dugi rat", "istria", "croatiaistrien", "kastela", "kaštela", "krk", "kvarner", "kvarner gulf", "punat", "rijeka", "rogoznica", "tribunj", "vodice", "primosten", "primošten"],
    searchTerms: ["croatia", "hrvatska", "split", "sibenik", "šibenik", "zadar", "pula", "trogir", "sukosan", "sukošan", "dubrovnik", "dalmatia", "biograd", "biograd na moru", "dugi rat", "istria", "croatiaistrien", "kastela", "kaštela", "krk", "kvarner", "kvarner gulf", "punat", "rijeka", "rogoznica", "tribunj", "vodice", "primosten", "primošten"],
  },
  {
    slug: "turkey",
    label: "Turkey",
    country: "Turkey",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["bodrum", "marmaris", "antalya", "cesme", "çeşme", "didim", "gocek", "göcek", "fethiye", "istanbul", "mugla", "muğla", "atokoy marina", "atakoy marina"],
    searchTerms: ["turkey", "bodrum", "marmaris", "antalya", "cesme", "çeşme", "didim", "gocek", "göcek", "fethiye", "istanbul", "mugla", "muğla", "atokoy marina", "atakoy marina"],
  },
  {
    slug: "malta",
    label: "Malta",
    country: "Malta",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["ta xbiex", "ta' xbiex", "valletta", "pieta", "birgu"],
    searchTerms: ["malta", "ta xbiex", "ta' xbiex", "valletta", "pieta", "birgu"],
  },
  {
    slug: "cyprus",
    label: "Cyprus",
    country: "Cyprus",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["limassol"],
    searchTerms: ["cyprus", "limassol"],
  },
  {
    slug: "portugal",
    label: "Portugal",
    country: "Portugal",
    region: "Portugal",
    aliases: ["azores", "lagos", "lisboa", "lisbon", "vilamoura"],
    searchTerms: ["portugal", "azores", "lagos", "lisboa", "lisbon", "vilamoura"],
  },
  {
    slug: "slovenia",
    label: "Slovenia",
    country: "Slovenia",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["izola"],
    searchTerms: ["slovenia", "izola"],
  },
  {
    slug: "monaco",
    label: "Monaco",
    country: "Monaco",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: [],
    searchTerms: ["monaco"],
  },
  {
    slug: "netherlands",
    label: "Netherlands",
    country: "Netherlands",
    region: "Netherlands",
    aliases: ["holland", "nederland", "amsterdam", "lelystad", "medemblik", "muiderzand", "naarden", "op de wal bij delta yacht", "delta yacht", "cb selections showroom medemblik", "sneek", "friesland", "kortgene", "schepenkring", "roermond", "wemeldinge", "workum"],
    searchTerms: ["netherlands", "holland", "nederland", "amsterdam", "lelystad", "medemblik", "muiderzand", "naarden", "op de wal bij delta yacht", "delta yacht", "cb selections showroom medemblik", "sneek", "friesland", "kortgene", "schepenkring", "roermond", "wemeldinge", "workum"],
  },
  {
    slug: "denmark",
    label: "Denmark",
    country: "Denmark",
    region: "Denmark",
    aliases: ["haderslev", "jutland", "east coast of jutland", "rungsted havn"],
    searchTerms: ["denmark", "haderslev", "jutland", "east coast of jutland", "rungsted havn"],
  },
  {
    slug: "belgium",
    label: "Belgium",
    country: "Belgium",
    region: "Belgium",
    aliases: ["antwerp", "nieuwpoort"],
    searchTerms: ["belgium", "antwerp", "nieuwpoort"],
  },
  {
    slug: "ireland",
    label: "Ireland",
    country: "Ireland",
    region: "Ireland",
    aliases: ["dublin", "dun laoghaire", "crosshaven", "cork", "greystones", "kilrush", "co clare"],
    searchTerms: ["ireland", "dublin", "dun laoghaire", "crosshaven", "cork", "greystones", "kilrush", "co clare"],
  },
  {
    slug: "germany",
    label: "Germany",
    country: "Germany",
    region: "Germany",
    aliases: ["allemagne", "berlin", "breege", "flensburg", "flensburg fjord", "mecklenburg", "mecklenburg-vorpommern", "schleswig-holstein", "schleswig holstein", "siek"],
    searchTerms: ["germany", "allemagne", "berlin", "breege", "flensburg", "flensburg fjord", "mecklenburg", "mecklenburg-vorpommern", "schleswig-holstein", "schleswig holstein", "siek"],
  },
  {
    slug: "poland",
    label: "Poland",
    country: "Poland",
    region: "Poland",
    aliases: ["gdansk", "gdańsk"],
    searchTerms: ["poland", "gdansk", "gdańsk"],
  },
  {
    slug: "martinique",
    label: "Martinique",
    country: "Martinique",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["le marin", "les trois-ilets", "les trois-îlets"],
    searchTerms: ["martinique", "le marin", "les trois-ilets", "les trois-îlets"],
  },
  {
    slug: "antigua",
    label: "Antigua",
    country: "Antigua and Barbuda",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["english harbour", "jolly harbour"],
    searchTerms: ["antigua", "english harbour", "jolly harbour"],
  },
  {
    slug: "grenada",
    label: "Grenada",
    country: "Grenada",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["grenade", "clarke's court", "clarkes court", "clarke's court boatyard", "port louis marina", "spice island marine", "st george", "st george's", "st georges", "saint george", "saint-georges"],
    searchTerms: ["grenada", "grenade", "clarke's court", "clarkes court", "clarke's court boatyard", "port louis marina", "spice island marine", "st george", "st george's", "st georges", "saint george", "saint-georges"],
  },
  {
    slug: "saint-lucia",
    label: "Saint Lucia",
    country: "Saint Lucia",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["st lucia", "st. lucia"],
    searchTerms: ["saint lucia", "st lucia", "st. lucia"],
  },
  {
    slug: "dominican-republic",
    label: "Dominican Republic",
    country: "Dominican Republic",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["luperon", "samana", "samaná"],
    searchTerms: ["dominican republic", "luperon", "samana", "samaná"],
  },
  {
    slug: "guadeloupe",
    label: "Guadeloupe",
    country: "Guadeloupe",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["marina bas du fort", "la marina bas du fort", "pointe-a-pitre", "pointe-à-pitre"],
    searchTerms: ["guadeloupe", "marina bas du fort", "la marina bas du fort", "pointe-a-pitre", "pointe-à-pitre"],
  },
  {
    slug: "st-maarten",
    label: "St Maarten",
    country: "Sint Maarten",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["st maarten", "st. maarten", "sint maarten", "saint martin", "st martin", "marigot", "dutch antilles"],
    searchTerms: ["st maarten", "st. maarten", "sint maarten", "saint martin", "st martin", "marigot", "dutch antilles"],
  },
  {
    slug: "sweden",
    label: "Sweden",
    country: "Sweden",
    region: "Sweden",
    aliases: ["stockholm", "blankaholm", "fiskeback", "fiskebäck", "fiskeback marinan", "fiskebäck marinan", "goteborg", "göteborg", "gothenburg", "landskrona", "limhamn", "loftahammar", "malmo", "malmö", "ystad", "henan", "henån"],
    searchTerms: ["sweden", "stockholm", "blankaholm", "fiskeback", "fiskebäck", "fiskeback marinan", "fiskebäck marinan", "goteborg", "göteborg", "gothenburg", "landskrona", "limhamn", "loftahammar", "malmo", "malmö", "ystad", "henan", "henån"],
  },
  {
    slug: "guernsey",
    label: "Guernsey",
    country: "Guernsey",
    region: "Channel Islands",
    aliases: ["alderney", "st peter port"],
    searchTerms: ["guernsey", "alderney", "st peter port"],
  },
  {
    slug: "jersey",
    label: "Jersey",
    country: "Jersey",
    region: "Channel Islands",
    aliases: ["saint helier", "st helier"],
    searchTerms: ["jersey", "saint helier", "st helier"],
  },
  {
    slug: "hong-kong",
    label: "Hong Kong",
    country: "Hong Kong",
    region: "Hong Kong",
    aliases: ["hong konghong kong"],
    searchTerms: ["hong kong", "hong konghong kong"],
  },
  {
    slug: "taiwan",
    label: "Taiwan",
    country: "Taiwan",
    region: "Taiwan",
    aliases: ["kaohsiung", "tainan", "province of china"],
    searchTerms: ["taiwan", "kaohsiung", "tainan", "province of china"],
  },
  {
    slug: "malaysia",
    label: "Malaysia",
    country: "Malaysia",
    region: "Malaysia",
    aliases: ["port dickson", "port dicksonmalaysia"],
    searchTerms: ["malaysia", "port dickson", "port dicksonmalaysia"],
  },
  {
    slug: "hungary",
    label: "Hungary",
    country: "Hungary",
    region: "Hungary",
    aliases: ["budapest", "balatonfured", "balatonfüred", "balatonvilagos", "balatonvilágos"],
    searchTerms: ["hungary", "budapest", "balatonfured", "balatonfüred", "balatonvilagos", "balatonvilágos"],
  },
  {
    slug: "aruba",
    label: "Aruba",
    country: "Aruba",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: [],
    searchTerms: ["aruba"],
  },
  {
    slug: "belize",
    label: "Belize",
    country: "Belize",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["belize city", "placencia"],
    searchTerms: ["belize", "belize city", "placencia"],
  },
  {
    slug: "tunisia",
    label: "Tunisia",
    country: "Tunisia",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["bizerte", "tunis", "bizerte tunis"],
    searchTerms: ["tunisia", "bizerte", "tunis", "bizerte tunis"],
  },
  {
    slug: "gibraltar",
    label: "Gibraltar",
    country: "Gibraltar",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: [],
    searchTerms: ["gibraltar"],
  },
  {
    slug: "norway",
    label: "Norway",
    country: "Norway",
    region: "Norway",
    aliases: ["hovik", "høvik"],
    searchTerms: ["norway", "hovik", "høvik"],
  },
  {
    slug: "latvia",
    label: "Latvia",
    country: "Latvia",
    region: "Latvia",
    aliases: [],
    searchTerms: ["latvia"],
  },
  {
    slug: "seychelles",
    label: "Seychelles",
    country: "Seychelles",
    region: "Seychelles",
    aliases: ["mahe", "mahé"],
    searchTerms: ["seychelles", "mahe", "mahé"],
  },
  {
    slug: "fiji",
    label: "Fiji",
    country: "Fiji",
    region: "South Pacific",
    aliases: [],
    searchTerms: ["fiji"],
  },
  {
    slug: "philippines",
    label: "Philippines",
    country: "Philippines",
    region: "Philippines",
    aliases: ["subic bay", "subic bay philippines"],
    searchTerms: ["philippines", "subic bay", "subic bay philippines"],
  },
  {
    slug: "montenegro",
    label: "Montenegro",
    country: "Montenegro",
    region: "Mediterranean",
    parentSlugs: ["mediterranean"],
    aliases: ["budva", "tivat"],
    searchTerms: ["montenegro", "budva", "tivat"],
  },
  {
    slug: "bermuda",
    label: "Bermuda",
    country: "Bermuda",
    region: "Bermuda",
    aliases: [],
    searchTerms: ["bermuda"],
  },
  {
    slug: "indonesia",
    label: "Indonesia",
    country: "Indonesia",
    region: "Indonesia",
    aliases: ["batam", "bali", "denpasar"],
    searchTerms: ["indonesia", "batam", "bali", "denpasar"],
  },
  {
    slug: "french-polynesia",
    label: "French Polynesia",
    country: "French Polynesia",
    region: "South Pacific",
    aliases: ["papeete", "tahiti"],
    searchTerms: ["french polynesia", "papeete", "tahiti"],
  },
  {
    slug: "honduras",
    label: "Honduras",
    country: "Honduras",
    region: "Caribbean",
    parentSlugs: ["caribbean"],
    aliases: ["roatan", "roatan bay islands"],
    searchTerms: ["honduras", "roatan", "roatan bay islands"],
  },
  {
    slug: "guatemala",
    label: "Guatemala",
    country: "Guatemala",
    region: "Guatemala",
    aliases: ["rio dulce", "rio dulce guatemala"],
    searchTerms: ["guatemala", "rio dulce", "rio dulce guatemala"],
  },
  {
    slug: "south-africa",
    label: "South Africa",
    country: "South Africa",
    region: "South Africa",
    aliases: ["cape town"],
    searchTerms: ["south africa", "cape town"],
  },
  {
    slug: "north-carolina",
    label: "North Carolina",
    country: "United States",
    region: "North Carolina",
    parentSlugs: ["united-states"],
    aliases: ["nc", "beaufort nc", "oriental nc", "wilmington nc"],
    searchTerms: ["north carolina", "nc", "beaufort nc", "oriental nc", "wilmington nc"],
  },
  {
    slug: "south-carolina",
    label: "South Carolina",
    country: "United States",
    region: "South Carolina",
    parentSlugs: ["united-states"],
    aliases: ["charleston", "charleston south carolina"],
    searchTerms: ["south carolina", "charleston", "charleston south carolina"],
  },
  {
    slug: "georgia-us",
    label: "Georgia",
    country: "United States",
    region: "Georgia",
    parentSlugs: ["united-states"],
    aliases: ["brunswick georgia", "savannah georgia", "st simons island", "st. simons island", "st simons island ga"],
    searchTerms: ["georgia", "brunswick georgia", "savannah georgia", "st simons island", "st. simons island", "st simons island ga"],
  },
  {
    slug: "new-england",
    label: "New England",
    country: "United States",
    region: "New England",
    parentSlugs: ["united-states"],
    aliases: ["rhode island", "portsmouth rhode island", "warwick rhode island", "connecticut", "groton connecticut", "maine", "rockport maine"],
    searchTerms: ["new england", "rhode island", "portsmouth rhode island", "warwick rhode island", "connecticut", "groton connecticut", "maine", "rockport maine"],
  },
  {
    slug: "hawaii",
    label: "Hawaii",
    country: "United States",
    region: "Hawaii",
    parentSlugs: ["united-states"],
    aliases: ["honolulu", "honolulu hawaii"],
    searchTerms: ["hawaii", "honolulu", "honolulu hawaii"],
  },
  {
    slug: "new-york",
    label: "New York",
    country: "United States",
    region: "New York",
    parentSlugs: ["united-states"],
    aliases: ["ny"],
    searchTerms: ["new york", "ny"],
  },
  {
    slug: "new-jersey",
    label: "New Jersey",
    country: "United States",
    region: "New Jersey",
    parentSlugs: ["united-states"],
    aliases: ["barnegat", "barnegat new jersey"],
    searchTerms: ["new jersey", "barnegat", "barnegat new jersey"],
  },
  {
    slug: "canada",
    label: "Canada",
    country: "Canada",
    region: "Canada",
    aliases: ["british columbia", "vancouver", "ontario", "thunder bay", "central vancouver island"],
    searchTerms: ["canada", "british columbia", "vancouver", "ontario", "thunder bay", "central vancouver island"],
  },
  {
    slug: "uk",
    label: "UK",
    country: "United Kingdom",
    region: "United Kingdom",
    aliases: [
      "united kingdom",
      "england",
      "scotland",
      "wales",
      "northern ireland",
      "hamble",
      "southampton",
      "plymouth",
      "devon",
      "falmouth",
      "suffolk yacht harbour",
      "ardrossan",
      "windermere",
      "cumbria",
      "gosport",
      "hampshire",
      "chichester",
      "lymington",
      "poole",
      "troon",
      "troon yacht haven",
      "burnham yacht harbour",
      "north wales",
      "bangor",
      "down",
      "lower swanwick",
      "portland marina",
      "conwy marina",
      "brixham",
      "isle of wight",
      "cowes",
      "largs",
      "newcastle upon tyne",
      "dartmouth",
      "eastbourne",
      "walton on the naze",
      "blyth",
      "burnham-on-crouch",
      "burnham on crouch",
      "burton",
      "cardiff",
      "dover",
      "dunoon",
      "eastney",
      "fowey",
      "hayling island",
      "keyhaven",
      "penarth marina",
      "portishead marina",
      "portsmouth eng",
      "pwllheli",
      "gwynedd",
      "haslar marina",
      "essex",
      "suffolk",
      "weymouth marina",
      "pembrokeshire",
      "argyll",
      "craobh marina",
      "deganwy",
      "emsworth",
      "gillingham",
      "greenock",
      "inverkip",
      "ipswich",
      "kingston upon hull",
      "kent",
      "medway yacht club",
      "milford haven",
      "mylor",
      "rhu",
      "solent",
      "swansea",
      "titchmarsh marina",
      "tollesbury marina",
      "torquay",
      "wareham",
      "weymouth",
      "whitehaven",
      "whitehaven eng",
      "yarmouth eng",
      "aldeburgh",
      "beaulieu",
      "bembridge harbour",
    ],
    searchTerms: [
      "uk",
      "united kingdom",
      "england",
      "scotland",
      "wales",
      "northern ireland",
      "hamble",
      "southampton",
      "plymouth",
      "devon",
      "falmouth",
      "suffolk yacht harbour",
      "ardrossan",
      "windermere",
      "cumbria",
      "gosport",
      "hampshire",
      "chichester",
      "lymington",
      "poole",
      "troon",
      "troon yacht haven",
      "burnham yacht harbour",
      "north wales",
      "bangor",
      "down",
      "lower swanwick",
      "portland marina",
      "conwy marina",
      "brixham",
      "isle of wight",
      "cowes",
      "largs",
      "newcastle upon tyne",
      "dartmouth",
      "eastbourne",
      "walton on the naze",
      "blyth",
      "burnham-on-crouch",
      "burnham on crouch",
      "burton",
      "cardiff",
      "dover",
      "dunoon",
      "eastney",
      "fowey",
      "hayling island",
      "keyhaven",
      "penarth marina",
      "portishead marina",
      "portsmouth eng",
      "pwllheli",
      "gwynedd",
      "haslar marina",
      "essex",
      "suffolk",
      "weymouth marina",
      "pembrokeshire",
      "argyll",
      "craobh marina",
      "deganwy",
      "emsworth",
      "gillingham",
      "greenock",
      "inverkip",
      "ipswich",
      "kingston upon hull",
      "kent",
      "medway yacht club",
      "milford haven",
      "mylor",
      "rhu",
      "solent",
      "swansea",
      "titchmarsh marina",
      "tollesbury marina",
      "torquay",
      "wareham",
      "weymouth",
      "whitehaven",
      "whitehaven eng",
      "yarmouth eng",
      "aldeburgh",
      "beaulieu",
      "bembridge harbour",
    ],
  },
  {
    slug: "washington-state",
    label: "Washington",
    country: "United States",
    region: "Pacific Northwest",
    parentSlugs: ["united-states", "pacific-northwest"],
    aliases: ["seattle", "anacortes", "port townsend"],
    searchTerms: ["washington", "seattle", "anacortes", "port townsend"],
  },
  {
    slug: "pacific-northwest",
    label: "Pacific Northwest",
    country: "United States",
    region: "Pacific Northwest",
    aliases: ["pnw", "seattle", "anacortes", "port townsend", "british columbia", "vancouver"],
    searchTerms: ["pacific northwest", "pnw", "seattle", "anacortes", "port townsend", "british columbia", "vancouver", "washington"],
  },
  {
    slug: "california",
    label: "California",
    country: "United States",
    region: "California",
    parentSlugs: ["united-states"],
    aliases: ["san diego", "san francisco", "ventura", "los angeles", "newport beach"],
    searchTerms: ["california", "san diego", "san francisco", "ventura", "los angeles", "newport beach"],
  },
  {
    slug: "chesapeake-bay",
    label: "Chesapeake Bay",
    country: "United States",
    region: "Chesapeake Bay",
    parentSlugs: ["united-states"],
    aliases: ["chesapeake", "annapolis", "maryland", "virginia", "norfolk"],
    searchTerms: ["chesapeake bay", "chesapeake", "annapolis", "maryland", "virginia", "norfolk"],
  },
  {
    slug: "great-lakes",
    label: "Great Lakes",
    country: "United States",
    region: "Great Lakes",
    parentSlugs: ["united-states"],
    aliases: ["lake michigan", "lake erie", "lake huron", "lake ontario", "lake superior", "michigan", "au gres", "au gres michigan", "bay city michigan", "ohio", "ashtabula ohio", "chicago"],
    searchTerms: ["great lakes", "lake michigan", "lake erie", "lake huron", "lake ontario", "lake superior", "michigan", "au gres", "au gres michigan", "bay city michigan", "ohio", "ashtabula ohio", "chicago"],
  },
  {
    slug: "mexico",
    label: "Mexico",
    country: "Mexico",
    region: "Mexico",
    aliases: ["sea of cortez", "baja", "cancun", "la paz", "puerto vallarta"],
    searchTerms: ["mexico", "sea of cortez", "baja", "cancun", "la paz", "puerto vallarta"],
  },
  {
    slug: "panama",
    label: "Panama",
    country: "Panama",
    region: "Panama",
    aliases: ["bocas del toro", "colon", "shelter bay"],
    searchTerms: ["panama", "bocas del toro", "colon", "shelter bay"],
  },
  {
    slug: "texas",
    label: "Texas",
    country: "United States",
    region: "Texas",
    parentSlugs: ["united-states"],
    aliases: ["corpus christi", "corpus christi texas", "kemah", "kemah texas", "league city", "league city tx"],
    searchTerms: ["texas", "tx", "corpus christi", "corpus christi texas", "kemah", "kemah texas", "league city", "league city tx"],
  },
  {
    slug: "australia",
    label: "Australia",
    country: "Australia",
    region: "Australia",
    aliases: ["queensland", "sydney", "brisbane", "gold coast"],
    searchTerms: ["australia", "queensland", "sydney", "brisbane", "gold coast"],
  },
  {
    slug: "thailand",
    label: "Thailand",
    country: "Thailand",
    region: "Thailand",
    aliases: ["phuket", "pattaya"],
    searchTerms: ["thailand", "phuket", "pattaya"],
  },
  {
    slug: "new-zealand",
    label: "New Zealand",
    country: "New Zealand",
    region: "New Zealand",
    aliases: ["nz", "auckland", "bay of islands"],
    searchTerms: ["new zealand", "auckland", "bay of islands"],
  },
];

export const FEATURED_LOCATION_MARKET_SLUGS = [
  "florida",
  "bahamas",
  "puerto-rico",
  "caribbean",
  "mediterranean",
  "california",
  "chesapeake-bay",
  "pacific-northwest",
];

function normalizeLocationLookupValue(value?: string | null) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsNormalizedTerm(normalizedText: string, candidate: string) {
  const normalizedCandidate = normalizeLocationLookupValue(candidate);
  if (normalizedCandidate.length < 2) return false;

  return ` ${normalizedText} `.includes(` ${normalizedCandidate} `);
}

const BROAD_ADMIN_ALIASES = new Set([
  "connecticut",
  "maine",
  "maryland",
  "michigan",
  "ohio",
  "rhode island",
  "virginia",
]);

function hasFiniteCoordinates(latitude?: number | null, longitude?: number | null) {
  return (
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function getTopLocationMarket(value?: string | null) {
  const normalized = normalizeLocationLookupValue(value);
  if (!normalized) return null;

  return (
    findMarketByCandidates(normalized, (market) => [market.slug, market.label]) ||
    findMarketByCandidates(normalized, (market) => market.aliases) ||
    findMarketByCandidates(normalized, (market) => market.searchTerms) ||
    null
  );
}

function findMarketByCandidates(
  normalized: string,
  getCandidates: (market: TopLocationMarket) => string[]
) {
  return TOP_LOCATION_MARKETS.find((market) =>
    getCandidates(market).some((candidate) => normalizeLocationLookupValue(candidate) === normalized)
  );
}

export function canonicalizeLocationParam(value?: string | null) {
  const market = getTopLocationMarket(value);
  const trimmed = String(value || "").trim();
  return market?.slug || trimmed || null;
}

export function getLocationDisplayName(value?: string | null) {
  const market = getTopLocationMarket(value);
  const trimmed = String(value || "").trim();
  return market?.label || trimmed;
}

export function getLocationSearchTerms(value?: string | null) {
  const market = getTopLocationMarket(value);
  const fallback = String(value || "").trim();
  const terms = market ? [market.label, ...market.searchTerms] : [fallback];
  const seen = new Set<string>();

  return terms
    .map((term) => term.trim())
    .filter((term) => {
      const key = term.toLowerCase();
      if (term.length < 2 || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getLocationMarketSlugs(value?: string | null) {
  const market = getTopLocationMarket(value);
  return market ? [market.slug] : [];
}

export function inferLocationMarketSignals(input: {
  locationText?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coordinatesApproximate?: boolean | null;
}): LocationMarketSignals {
  const normalizedLocation = normalizeLocationLookupValue(input.locationText);
  const hasCoordinates = hasFiniteCoordinates(input.latitude, input.longitude);
  const coordinatesApproximate = hasCoordinates && input.coordinatesApproximate === true;
  const matchedMarkets = normalizedLocation
    ? TOP_LOCATION_MARKETS.filter((market) =>
        [market.label, market.slug, ...market.aliases, ...market.searchTerms].some((term) =>
          containsNormalizedTerm(normalizedLocation, term)
        )
      )
    : [];
  const slugSet = new Set<string>();

  matchedMarkets.forEach((market) => {
    slugSet.add(market.slug);
    market.parentSlugs?.forEach((parentSlug) => slugSet.add(parentSlug));
  });

  const marketSlugs = TOP_LOCATION_MARKETS
    .map((market) => market.slug)
    .filter((slug) => slugSet.has(slug));
  const primaryMarket =
    matchedMarkets.find((market) => Boolean(market.country)) ?? matchedMarkets[0] ?? null;
  const hasLocationDetail = String(input.locationText || "").includes(",");
  const matchedByLocalTerm =
    hasLocationDetail ||
    matchedMarkets.some((market) =>
      Boolean(market.country) &&
      market.aliases.some((term) => {
        if (BROAD_ADMIN_ALIASES.has(normalizeLocationLookupValue(term))) return false;
        return containsNormalizedTerm(normalizedLocation, term);
      })
    );
  const confidence: LocationConfidence = hasCoordinates && !coordinatesApproximate
    ? "exact"
    : marketSlugs.length === 0
      ? "unknown"
      : matchedByLocalTerm
        ? "city"
        : "region";

  return {
    marketSlugs,
    country: primaryMarket?.country ?? null,
    region: primaryMarket?.region ?? primaryMarket?.label ?? null,
    confidence,
    approximate: !hasCoordinates || coordinatesApproximate,
  };
}

export function getFeaturedLocationMarkets() {
  return FEATURED_LOCATION_MARKET_SLUGS
    .map((slug) => getTopLocationMarket(slug))
    .filter((market): market is TopLocationMarket => Boolean(market));
}

export function escapeSqlLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export function buildLocationLikePattern(value: string) {
  return `%${escapeSqlLikePattern(value.trim().toLowerCase())}%`;
}
