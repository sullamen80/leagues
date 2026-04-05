const parseCatalog = (label, raw) => ({
  label,
  teams: raw
    .trim()
    .split('\n')
    .map((line) => {
      const [iconCode, id, name, shortName] = line.split('|');
      return {
        iconCode,
        id,
        name,
        shortName: shortName || name
      };
    })
});

const catalogGroups = [
  parseCatalog('AFC', `
AF|afghanistan|Afghanistan
AU|australia|Australia
BH|bahrain|Bahrain
BD|bangladesh|Bangladesh
BT|bhutan|Bhutan
BN|brunei|Brunei
KH|cambodia|Cambodia
CN|china|China
TW|chinese-taipei|Chinese Taipei
GU|guam|Guam
HK|hong-kong|Hong Kong
IN|india|India
ID|indonesia|Indonesia
IR|iran|Iran
IQ|iraq|Iraq
JP|japan|Japan
JO|jordan|Jordan
KP|north-korea|North Korea
KR|south-korea|South Korea
KW|kuwait|Kuwait
KG|kyrgyzstan|Kyrgyzstan
LA|laos|Laos
LB|lebanon|Lebanon
MO|macau|Macau
MY|malaysia|Malaysia
MV|maldives|Maldives
MN|mongolia|Mongolia
MM|myanmar|Myanmar
NP|nepal|Nepal
OM|oman|Oman
PK|pakistan|Pakistan
PS|palestine|Palestine
PH|philippines|Philippines
QA|qatar|Qatar
SA|saudi-arabia|Saudi Arabia
SG|singapore|Singapore
LK|sri-lanka|Sri Lanka
SY|syria|Syria
TJ|tajikistan|Tajikistan
TH|thailand|Thailand
TL|timor-leste|Timor-Leste
TM|turkmenistan|Turkmenistan
AE|united-arab-emirates|United Arab Emirates|UAE
UZ|uzbekistan|Uzbekistan
VN|vietnam|Vietnam
YE|yemen|Yemen
  `),
  parseCatalog('CAF', `
DZ|algeria|Algeria
AO|angola|Angola
BJ|benin|Benin
BW|botswana|Botswana
BF|burkina-faso|Burkina Faso
BI|burundi|Burundi
CM|cameroon|Cameroon
CV|cape-verde|Cape Verde
CF|central-african-republic|Central African Republic
TD|chad|Chad
KM|comoros|Comoros
CG|congo|Congo
CD|congo-dr|Congo DR
CI|ivory-coast|Ivory Coast
DJ|djibouti|Djibouti
EG|egypt|Egypt
GQ|equatorial-guinea|Equatorial Guinea
ER|eritrea|Eritrea
SZ|eswatini|Eswatini
ET|ethiopia|Ethiopia
GA|gabon|Gabon
GM|gambia|Gambia
GH|ghana|Ghana
GN|guinea|Guinea
GW|guinea-bissau|Guinea-Bissau
KE|kenya|Kenya
LS|lesotho|Lesotho
LR|liberia|Liberia
LY|libya|Libya
MG|madagascar|Madagascar
MW|malawi|Malawi
ML|mali|Mali
MR|mauritania|Mauritania
MU|mauritius|Mauritius
MA|morocco|Morocco
MZ|mozambique|Mozambique
NA|namibia|Namibia
NE|niger|Niger
NG|nigeria|Nigeria
RW|rwanda|Rwanda
ST|sao-tome-and-principe|Sao Tome and Principe
SN|senegal|Senegal
SC|seychelles|Seychelles
SL|sierra-leone|Sierra Leone
SO|somalia|Somalia
ZA|south-africa|South Africa
SS|south-sudan|South Sudan
SD|sudan|Sudan
TZ|tanzania|Tanzania
TG|togo|Togo
TN|tunisia|Tunisia
UG|uganda|Uganda
ZM|zambia|Zambia
ZW|zimbabwe|Zimbabwe
  `),
  parseCatalog('CONCACAF', `
AI|anguilla|Anguilla
AG|antigua-and-barbuda|Antigua and Barbuda
AW|aruba|Aruba
BS|bahamas|Bahamas
BB|barbados|Barbados
BM|bermuda|Bermuda
BZ|belize|Belize
VG|british-virgin-islands|British Virgin Islands
CA|canada|Canada
KY|cayman-islands|Cayman Islands
CR|costa-rica|Costa Rica
CU|cuba|Cuba
CW|curacao|Curacao
DM|dominica|Dominica
DO|dominican-republic|Dominican Republic
SV|el-salvador|El Salvador
GD|grenada|Grenada
GT|guatemala|Guatemala
GY|guyana|Guyana
HT|haiti|Haiti
HN|honduras|Honduras
JM|jamaica|Jamaica
MX|mexico|Mexico
MS|montserrat|Montserrat
NI|nicaragua|Nicaragua
PA|panama|Panama
PR|puerto-rico|Puerto Rico
KN|saint-kitts-and-nevis|Saint Kitts and Nevis
LC|saint-lucia|Saint Lucia
VC|saint-vincent-and-the-grenadines|Saint Vincent and the Grenadines
SR|suriname|Suriname
TT|trinidad-and-tobago|Trinidad and Tobago
TC|turks-and-caicos-islands|Turks and Caicos Islands
US|united-states|United States|USA
VI|us-virgin-islands|US Virgin Islands
  `),
  parseCatalog('CONMEBOL', `
AR|argentina|Argentina
BO|bolivia|Bolivia
BR|brazil|Brazil
CL|chile|Chile
CO|colombia|Colombia
EC|ecuador|Ecuador
PY|paraguay|Paraguay
PE|peru|Peru
UY|uruguay|Uruguay
VE|venezuela|Venezuela
  `),
  parseCatalog('OFC', `
AS|american-samoa|American Samoa
CK|cook-islands|Cook Islands
FJ|fiji|Fiji
NZ|new-zealand|New Zealand
NC|new-caledonia|New Caledonia
PG|papua-new-guinea|Papua New Guinea
PF|tahiti|Tahiti
WS|samoa|Samoa
SB|solomon-islands|Solomon Islands
TO|tonga|Tonga
VU|vanuatu|Vanuatu
  `),
  parseCatalog('UEFA', `
AL|albania|Albania
AD|andorra|Andorra
AM|armenia|Armenia
AT|austria|Austria
AZ|azerbaijan|Azerbaijan
BY|belarus|Belarus
BE|belgium|Belgium
BA|bosnia-herzegovina|Bosnia and Herzegovina
BG|bulgaria|Bulgaria
HR|croatia|Croatia
CY|cyprus|Cyprus
CZ|czechia|Czechia
DK|denmark|Denmark
ENG|england|England
EE|estonia|Estonia
FO|faroe-islands|Faroe Islands
FI|finland|Finland
FR|france|France
GE|georgia|Georgia
DE|germany|Germany
GI|gibraltar|Gibraltar
GR|greece|Greece
HU|hungary|Hungary
IS|iceland|Iceland
IL|israel|Israel
IT|italy|Italy
KZ|kazakhstan|Kazakhstan
XK|kosovo|Kosovo
LV|latvia|Latvia
LI|liechtenstein|Liechtenstein
LT|lithuania|Lithuania
LU|luxembourg|Luxembourg
MT|malta|Malta
MD|moldova|Moldova
ME|montenegro|Montenegro
NL|netherlands|Netherlands
MK|north-macedonia|North Macedonia
NIR|northern-ireland|Northern Ireland
NO|norway|Norway
PL|poland|Poland
PT|portugal|Portugal
IE|ireland|Ireland
RO|romania|Romania
RU|russia|Russia
SM|san-marino|San Marino
SCO|scotland|Scotland
RS|serbia|Serbia
SK|slovakia|Slovakia
SI|slovenia|Slovenia
ES|spain|Spain
SE|sweden|Sweden
CH|switzerland|Switzerland
TR|turkiye|Turkiye
UA|ukraine|Ukraine
WAL|wales|Wales
  `)
];

export const FIFA_TEAM_GROUPS = catalogGroups;
export const FIFA_TEAM_CATALOG = catalogGroups.flatMap((group) => group.teams);
export const FIFA_TEAM_LOOKUP = Object.fromEntries(FIFA_TEAM_CATALOG.map((team) => [team.id, team]));

export const getFifaTeamIcon = (iconCode = '') => {
  const normalized = String(iconCode || '').trim().toUpperCase();
  if (!normalized) {
    return '';
  }

  if (normalized.length === 2) {
    return String.fromCodePoint(
      ...normalized.split('').map((char) => 127397 + char.charCodeAt(0))
    );
  }

  return normalized;
};

export const getFifaTeamLabel = (team) => {
  const icon = getFifaTeamIcon(team?.iconCode);
  return [icon, team?.name].filter(Boolean).join(' ');
};
