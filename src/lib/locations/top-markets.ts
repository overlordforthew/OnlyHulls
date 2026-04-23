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

export interface LocationCountryHint {
  country: string;
  region: string;
  matchedTerm: string;
}

type MarketCandidateSource = "label" | "slug" | "alias" | "searchTerm" | "country";

type MarketMatch = {
  market: TopLocationMarket;
  normalizedTerm: string;
  source: MarketCandidateSource;
  score: number;
  explicitCountry: boolean;
};

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
    slug: "colombia",
    label: "Colombia",
    country: "Colombia",
    region: "Colombia",
    aliases: ["cartagena de indias", "cartagena colombia", "santa marta"],
    searchTerms: ["colombia", "cartagena de indias", "cartagena colombia", "santa marta"],
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
    aliases: ["barnegat", "barnegat new jersey", "forked river", "forked river new jersey", "jersey city", "jersey city nj", "nj", "n j", "parlin", "parlin new jersey"],
    searchTerms: ["new jersey", "barnegat", "barnegat new jersey", "forked river", "forked river new jersey", "jersey city", "jersey city nj", "nj", "n j", "parlin", "parlin new jersey"],
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
    aliases: [
      "washington state",
      "seattle",
      "anacortes",
      "port townsend",
      "bainbridge island",
      "port orchard",
      "cathlamet",
      "bremerton",
      "port ludlow",
      "coupeville",
      "poulsbo",
      "port hadlock",
    ],
    searchTerms: [
      "washington state",
      "seattle",
      "anacortes",
      "port townsend",
      "bainbridge island",
      "port orchard",
      "cathlamet",
      "bremerton",
      "port ludlow",
      "coupeville",
      "poulsbo",
      "port hadlock",
    ],
  },
  {
    slug: "pacific-northwest",
    label: "Pacific Northwest",
    country: "United States",
    region: "Pacific Northwest",
    aliases: ["pnw", "seattle", "anacortes", "port townsend", "british columbia", "vancouver"],
    searchTerms: ["pacific northwest", "pnw", "seattle", "anacortes", "port townsend", "british columbia", "vancouver", "washington state"],
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
    aliases: ["bocas del toro", "colon", "shelter bay", "linton bay", "linton bay marina"],
    searchTerms: ["panama", "bocas del toro", "colon", "shelter bay", "linton bay", "linton bay marina"],
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

const CROSS_BORDER_MARKET_SLUGS = new Set(["pacific-northwest"]);
const BARE_WASHINGTON_MARKET_SLUGS = new Set(["washington-state", "pacific-northwest"]);

const EXPLICIT_COUNTRY_EXCLUSION_PHRASES: Record<string, string[]> = {
  jersey: ["jersey city", "new jersey"],
};

function isCountryTermExcluded(normalizedLocation: string, normalizedCountry: string) {
  return (EXPLICIT_COUNTRY_EXCLUSION_PHRASES[normalizedCountry] || []).some((phrase) =>
    containsNormalizedTerm(normalizedLocation, phrase)
  );
}

function isCountryLevelMarket(market: TopLocationMarket) {
  if (!market.country) return false;
  return normalizeLocationLookupValue(market.region || market.country) === normalizeLocationLookupValue(market.country);
}

const ADMIN_COUNTRY_HINTS: LocationCountryHint[] = [
  { country: "United States", region: "Alabama", matchedTerm: "alabama" },
  { country: "United States", region: "Alaska", matchedTerm: "alaska" },
  { country: "United States", region: "Arizona", matchedTerm: "arizona" },
  { country: "United States", region: "Arkansas", matchedTerm: "arkansas" },
  { country: "United States", region: "California", matchedTerm: "california" },
  { country: "United States", region: "California", matchedTerm: "ca" },
  { country: "United States", region: "Colorado", matchedTerm: "colorado" },
  { country: "United States", region: "Connecticut", matchedTerm: "connecticut" },
  { country: "United States", region: "Delaware", matchedTerm: "delaware" },
  { country: "United States", region: "Florida", matchedTerm: "florida" },
  { country: "United States", region: "Florida", matchedTerm: "fl" },
  { country: "United States", region: "Georgia", matchedTerm: "georgia" },
  { country: "United States", region: "Georgia", matchedTerm: "ga" },
  { country: "United States", region: "Hawaii", matchedTerm: "hawaii" },
  { country: "United States", region: "Hawaii", matchedTerm: "hi" },
  { country: "United States", region: "Idaho", matchedTerm: "idaho" },
  { country: "United States", region: "Illinois", matchedTerm: "illinois" },
  { country: "United States", region: "Indiana", matchedTerm: "indiana" },
  { country: "United States", region: "Iowa", matchedTerm: "iowa" },
  { country: "United States", region: "Kansas", matchedTerm: "kansas" },
  { country: "United States", region: "Kentucky", matchedTerm: "kentucky" },
  { country: "United States", region: "Louisiana", matchedTerm: "louisiana" },
  { country: "United States", region: "New England", matchedTerm: "maine" },
  { country: "United States", region: "Maryland", matchedTerm: "maryland" },
  { country: "United States", region: "Maryland", matchedTerm: "md" },
  { country: "United States", region: "Massachusetts", matchedTerm: "massachusetts" },
  { country: "United States", region: "Michigan", matchedTerm: "michigan" },
  { country: "United States", region: "Michigan", matchedTerm: "mi" },
  { country: "United States", region: "Minnesota", matchedTerm: "minnesota" },
  { country: "United States", region: "Mississippi", matchedTerm: "mississippi" },
  { country: "United States", region: "Missouri", matchedTerm: "missouri" },
  { country: "United States", region: "Montana", matchedTerm: "montana" },
  { country: "United States", region: "Nebraska", matchedTerm: "nebraska" },
  { country: "United States", region: "Nevada", matchedTerm: "nevada" },
  { country: "United States", region: "New Hampshire", matchedTerm: "new hampshire" },
  { country: "United States", region: "New Jersey", matchedTerm: "new jersey" },
  { country: "United States", region: "New Jersey", matchedTerm: "nj" },
  { country: "United States", region: "New Jersey", matchedTerm: "n j" },
  { country: "United States", region: "New Mexico", matchedTerm: "new mexico" },
  { country: "United States", region: "New York", matchedTerm: "new york" },
  { country: "United States", region: "New York", matchedTerm: "ny" },
  { country: "United States", region: "North Carolina", matchedTerm: "north carolina" },
  { country: "United States", region: "North Carolina", matchedTerm: "nc" },
  { country: "United States", region: "North Dakota", matchedTerm: "north dakota" },
  { country: "United States", region: "Ohio", matchedTerm: "ohio" },
  { country: "United States", region: "Oklahoma", matchedTerm: "oklahoma" },
  { country: "United States", region: "Oregon", matchedTerm: "oregon" },
  { country: "United States", region: "Pennsylvania", matchedTerm: "pennsylvania" },
  { country: "United States", region: "Rhode Island", matchedTerm: "rhode island" },
  { country: "United States", region: "Rhode Island", matchedTerm: "ri" },
  { country: "United States", region: "South Carolina", matchedTerm: "south carolina" },
  { country: "United States", region: "South Carolina", matchedTerm: "sc" },
  { country: "United States", region: "South Dakota", matchedTerm: "south dakota" },
  { country: "United States", region: "Tennessee", matchedTerm: "tennessee" },
  { country: "United States", region: "Texas", matchedTerm: "texas" },
  { country: "United States", region: "Texas", matchedTerm: "tx" },
  { country: "United States", region: "Utah", matchedTerm: "utah" },
  { country: "United States", region: "Vermont", matchedTerm: "vermont" },
  { country: "United States", region: "Virginia", matchedTerm: "virginia" },
  { country: "United States", region: "Virginia", matchedTerm: "va" },
  { country: "United States", region: "Washington", matchedTerm: "washington state" },
  { country: "United States", region: "Washington", matchedTerm: "wa" },
  { country: "United States", region: "West Virginia", matchedTerm: "west virginia" },
  { country: "United States", region: "Wisconsin", matchedTerm: "wisconsin" },
  { country: "United States", region: "Wyoming", matchedTerm: "wyoming" },
  { country: "Canada", region: "British Columbia", matchedTerm: "british columbia" },
  { country: "Canada", region: "British Columbia", matchedTerm: "british columbia ca" },
  { country: "Canada", region: "British Columbia", matchedTerm: "bc ca" },
  { country: "Canada", region: "British Columbia", matchedTerm: "bc" },
  { country: "Canada", region: "Ontario", matchedTerm: "ontario" },
  { country: "Canada", region: "Ontario", matchedTerm: "toronto" },
  { country: "Canada", region: "Ontario", matchedTerm: "ottawa" },
  { country: "Canada", region: "Quebec", matchedTerm: "quebec" },
  { country: "Canada", region: "Quebec", matchedTerm: "montreal" },
  { country: "Canada", region: "Nova Scotia", matchedTerm: "nova scotia" },
  { country: "Canada", region: "Nova Scotia", matchedTerm: "halifax" },
  { country: "Mexico", region: "Baja California", matchedTerm: "baja california" },
  { country: "Mexico", region: "Baja California Sur", matchedTerm: "baja california sur" },
];

const COUNTRY_HINT_SYNONYMS: LocationCountryHint[] = [
  { country: "British Virgin Islands", region: "Caribbean", matchedTerm: "bvi" },
  { country: "United States", region: "United States", matchedTerm: "usa" },
  { country: "United States", region: "United States", matchedTerm: "united states of america" },
  { country: "United States Virgin Islands", region: "Caribbean", matchedTerm: "usvi" },
  { country: "United States Virgin Islands", region: "Caribbean", matchedTerm: "us virgin islands" },
  { country: "United States Virgin Islands", region: "Caribbean", matchedTerm: "u s virgin islands" },
  { country: "United Kingdom", region: "United Kingdom", matchedTerm: "uk" },
  { country: "United Kingdom", region: "United Kingdom", matchedTerm: "u k" },
  { country: "Spain", region: "Mediterranean", matchedTerm: "espagne" },
  { country: "Turkey", region: "Mediterranean", matchedTerm: "turkiye" },
  { country: "Trinidad and Tobago", region: "Caribbean", matchedTerm: "trinidad" },
  { country: "Trinidad and Tobago", region: "Caribbean", matchedTerm: "trinidad and tobago" },
  { country: "Trinidad and Tobago", region: "Caribbean", matchedTerm: "trinidad tobago" },
  { country: "Jamaica", region: "Caribbean", matchedTerm: "jamaica" },
  { country: "Jamaica", region: "Caribbean", matchedTerm: "kingston jamaica" },
  { country: "Jamaica", region: "Caribbean", matchedTerm: "montego bay" },
  { country: "Curacao", region: "Caribbean", matchedTerm: "curacao" },
  { country: "Costa Rica", region: "Central America", matchedTerm: "costa rica" },
  { country: "Singapore", region: "Asia", matchedTerm: "singapore" },
  { country: "Bulgaria", region: "Black Sea", matchedTerm: "bulgaria" },
];

function getLocationCountryHints(): LocationCountryHint[] {
  const byTerm = new Map<string, LocationCountryHint>();

  for (const market of TOP_LOCATION_MARKETS) {
    if (!market.country) continue;
    const hint = {
      country: market.country,
      region: market.region || market.country,
      matchedTerm: market.country,
    };
    const key = normalizeLocationLookupValue(hint.matchedTerm);
    if (!byTerm.has(key)) byTerm.set(key, hint);
  }

  for (const hint of [...COUNTRY_HINT_SYNONYMS, ...ADMIN_COUNTRY_HINTS]) {
    byTerm.set(normalizeLocationLookupValue(hint.matchedTerm), hint);
  }

  return Array.from(byTerm.values());
}

function shouldAcceptCountryHint(normalizedLocation: string, normalizedTerm: string) {
  if (normalizedTerm !== "ca") return true;

  return ![
    "bc ca",
    "british columbia ca",
    "canada",
    "vancouver",
    "victoria bc",
    "ontario ca",
  ].some((term) => containsNormalizedTerm(normalizedLocation, term));
}

function shouldAcceptMarketCandidate(market: TopLocationMarket, normalizedTerm: string) {
  if (normalizedTerm === "washington" && BARE_WASHINGTON_MARKET_SLUGS.has(market.slug)) {
    return false;
  }

  return true;
}

export function resolveLocationCountryHint(locationText?: string | null): LocationCountryHint | null {
  const normalizedLocation = normalizeLocationLookupValue(locationText);
  if (!normalizedLocation) return null;

  const matches = getLocationCountryHints()
    .map((hint) => {
      const normalizedTerm = normalizeLocationLookupValue(hint.matchedTerm);
      if (!containsNormalizedTerm(normalizedLocation, normalizedTerm)) return null;
      if (isCountryTermExcluded(normalizedLocation, normalizeLocationLookupValue(hint.country))) {
        return null;
      }
      if (!shouldAcceptCountryHint(normalizedLocation, normalizedTerm)) {
        return null;
      }

      const isAdminHint = ADMIN_COUNTRY_HINTS.some(
        (adminHint) =>
          normalizeLocationLookupValue(adminHint.matchedTerm) === normalizedTerm &&
          adminHint.country === hint.country
      );
      const priority = isAdminHint ? 600 : 1000;
      return {
        hint,
        score: priority + normalizedTerm.length,
      };
    })
    .filter((match): match is { hint: LocationCountryHint; score: number } => Boolean(match))
    .sort((left, right) => right.score - left.score);

  return matches[0]?.hint ?? null;
}

function getMarketMatch(normalizedLocation: string, market: TopLocationMarket): MarketMatch | null {
  const candidates: Array<{ source: MarketCandidateSource; term: string }> = [
    { source: "label", term: market.label },
    { source: "slug", term: market.slug },
    ...(isCountryLevelMarket(market)
      ? [{ source: "country" as const, term: market.country || "" }]
      : []),
    ...market.aliases.map((term) => ({ source: "alias" as const, term })),
    ...market.searchTerms.map((term) => ({ source: "searchTerm" as const, term })),
  ];
  let bestMatch: MarketMatch | null = null;

  for (const candidate of candidates) {
    const normalizedTerm = normalizeLocationLookupValue(candidate.term);
    if (normalizedTerm.length < 2 || !containsNormalizedTerm(normalizedLocation, normalizedTerm)) {
      continue;
    }
    if (!shouldAcceptMarketCandidate(market, normalizedTerm)) {
      continue;
    }

    const normalizedCountry = normalizeLocationLookupValue(market.country);
    const explicitCountry =
      Boolean(market.country) &&
      normalizedTerm === normalizedCountry &&
      containsNormalizedTerm(normalizedLocation, market.country || "") &&
      !isCountryTermExcluded(normalizedLocation, normalizedCountry);
    const score =
      normalizedTerm.length +
      (explicitCountry ? 300 : 0) +
      (candidate.source === "label" ? 40 : 0) +
      (candidate.source === "slug" ? 30 : 0) +
      (candidate.source === "alias" ? 20 : 0) +
      (explicitCountry ? 700 : 0);

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        market,
        normalizedTerm,
        source: candidate.source,
        score,
        explicitCountry,
      };
    }
  }

  return bestMatch;
}

function getMarketMatches(normalizedLocation: string) {
  return TOP_LOCATION_MARKETS
    .map((market) => getMarketMatch(normalizedLocation, market))
    .filter((match): match is MarketMatch => Boolean(match));
}

function getMarketsForCountryHint(countryHint: LocationCountryHint | null) {
  if (!countryHint) return [];

  const hintedCountry = normalizeLocationLookupValue(countryHint.country);
  const hintedRegion = normalizeLocationLookupValue(countryHint.region);
  if (!hintedCountry || !hintedRegion) return [];

  return TOP_LOCATION_MARKETS.filter((market) => {
    if (!market.country) return false;
    if (normalizeLocationLookupValue(market.country) !== hintedCountry) return false;

    const marketRegion = normalizeLocationLookupValue(market.region || market.country);
    return marketRegion === hintedRegion || normalizeLocationLookupValue(market.label) === hintedRegion;
  });
}

function getPrimaryMarketMatch(matches: MarketMatch[]) {
  return matches
    .filter((match) => Boolean(match.market.country))
    .sort((left, right) => {
      if (right.explicitCountry !== left.explicitCountry) {
        return Number(right.explicitCountry) - Number(left.explicitCountry);
      }
      return right.score - left.score;
    })[0] ?? matches[0] ?? null;
}

function isMatchShadowed(
  match: MarketMatch,
  matches: MarketMatch[],
  primaryMatch: MarketMatch | null,
  countryHint: LocationCountryHint | null
) {
  const country = normalizeLocationLookupValue(match.market.country);
  const primaryCountry = normalizeLocationLookupValue(primaryMatch?.market.country);
  const hintedCountry = normalizeLocationLookupValue(countryHint?.country);

  if (country && hintedCountry && country !== hintedCountry && !CROSS_BORDER_MARKET_SLUGS.has(match.market.slug)) {
    return true;
  }

  if (
    primaryMatch?.explicitCountry &&
    country &&
    primaryCountry &&
    country !== primaryCountry
  ) {
    return true;
  }

  return matches.some((other) => {
    if (other === match || other.score <= match.score) return false;
    if (normalizeLocationLookupValue(other.market.country) === country) return false;
    if (!other.normalizedTerm.includes(match.normalizedTerm)) return false;
    return other.normalizedTerm !== match.normalizedTerm;
  });
}

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
  const marketMatches = normalizedLocation ? getMarketMatches(normalizedLocation) : [];
  const primaryMatch = getPrimaryMarketMatch(marketMatches);
  const countryHint = resolveLocationCountryHint(input.locationText);
  const inferredMarkets = marketMatches
    .filter((match) => !isMatchShadowed(match, marketMatches, primaryMatch, countryHint))
    .map((match) => match.market);
  const matchedMarkets = [...inferredMarkets, ...getMarketsForCountryHint(countryHint)].filter(
    (market, index, markets) => markets.findIndex((candidate) => candidate.slug === market.slug) === index
  );
  const slugSet = new Set<string>();

  matchedMarkets.forEach((market) => {
    slugSet.add(market.slug);
    market.parentSlugs?.forEach((parentSlug) => slugSet.add(parentSlug));
  });

  const marketSlugs = TOP_LOCATION_MARKETS
    .map((market) => market.slug)
    .filter((slug) => slugSet.has(slug));
  const primaryMarket = matchedMarkets.includes(primaryMatch?.market as TopLocationMarket)
    ? primaryMatch?.market ?? null
    : matchedMarkets.find((market) => Boolean(market.country)) ?? matchedMarkets[0] ?? null;
  const regionalMarket =
    matchedMarkets.find((market) => Boolean(market.country) && !isCountryLevelMarket(market)) ??
    primaryMarket;
  const hintedRegion =
    countryHint &&
    normalizeLocationLookupValue(countryHint.region) !== normalizeLocationLookupValue(countryHint.country)
      ? countryHint.region
      : null;
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
    country: countryHint?.country ?? primaryMarket?.country ?? null,
    region: hintedRegion ?? regionalMarket?.region ?? regionalMarket?.label ?? null,
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
