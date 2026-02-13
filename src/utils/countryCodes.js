export const countryToCode = {
    // EMEA
    "UK": "gb",
    "United Kingdom": "gb",
    "France": "fr",
    "Germany": "de",
    "German": "de",
    "Spain": "es",
    "Turkey": "tr",
    "Russia": "ru",
    "Sweden": "se",
    "Denmark": "dk",
    "Poland": "pl",
    "Finland": "fi",
    "Norway": "no",
    "Belgium": "be",
    "Netherlands": "nl",
    "Italy": "it",
    "Portugal": "pt",
    "Czech Republic": "cz",
    "Romania": "ro",
    "Ukraine": "ua",
    "Lithuania": "lt",
    "Estonia": "ee",
    "Latvia": "lv",
    "Morocco": "ma",

    // Pacific
    "South Korea": "kr",
    "Japan": "jp",
    "Singapore": "sg",
    "Thailand": "th",
    "Indonesia": "id",
    "Philippines": "ph",
    "Australia": "au",
    "India": "in",
    "Vietnam": "vn",
    "Malaysia": "my",

    // Americas
    "Brazil": "br",
    "Argentina": "ar",
    "Chile": "cl",
    "USA": "us",
    "United States": "us",
    "Canada": "ca",
    "Mexico": "mx",
    "Peru": "pe",
    "Colombia": "co",
    "Uruguay": "uy",

    // China
    "China": "cn",

    // Others found in real_players.js or potential
    "Cambodia": "kh",
    "Lebanon": "lb",
    "Jordan": "jo",
    "Egypt": "eg",
    "Saudi Arabia": "sa",
    "United Arab Emirates": "ae"
};

export const getFlagUrl = (nationality) => {
    if (!nationality) return null;
    const code = countryToCode[nationality];
    if (!code) return null;
    return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
};
