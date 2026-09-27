export type Region = 'Africa' | 'Americas' | 'Asia' | 'Europe' | 'Oceania'

export interface Country {
  /** ISO 3166-1 alpha-2 code. */
  code: string
  name: string
  capital: string
  region: Region
}

// The 193 UN member states plus Vatican City: code|name|capital
const RAW: Record<Region, string> = {
  Africa: `DZ|Algeria|Algiers
AO|Angola|Luanda
BJ|Benin|Porto-Novo
BW|Botswana|Gaborone
BF|Burkina Faso|Ouagadougou
BI|Burundi|Gitega
CV|Cape Verde|Praia
CM|Cameroon|Yaoundé
CF|Central African Republic|Bangui
TD|Chad|N'Djamena
KM|Comoros|Moroni
CG|Republic of the Congo|Brazzaville
CD|DR Congo|Kinshasa
CI|Côte d'Ivoire|Yamoussoukro
DJ|Djibouti|Djibouti
EG|Egypt|Cairo
GQ|Equatorial Guinea|Malabo
ER|Eritrea|Asmara
SZ|Eswatini|Mbabane
ET|Ethiopia|Addis Ababa
GA|Gabon|Libreville
GM|Gambia|Banjul
GH|Ghana|Accra
GN|Guinea|Conakry
GW|Guinea-Bissau|Bissau
KE|Kenya|Nairobi
LS|Lesotho|Maseru
LR|Liberia|Monrovia
LY|Libya|Tripoli
MG|Madagascar|Antananarivo
MW|Malawi|Lilongwe
ML|Mali|Bamako
MR|Mauritania|Nouakchott
MU|Mauritius|Port Louis
MA|Morocco|Rabat
MZ|Mozambique|Maputo
NA|Namibia|Windhoek
NE|Niger|Niamey
NG|Nigeria|Abuja
RW|Rwanda|Kigali
ST|São Tomé and Príncipe|São Tomé
SN|Senegal|Dakar
SC|Seychelles|Victoria
SL|Sierra Leone|Freetown
SO|Somalia|Mogadishu
ZA|South Africa|Pretoria
SS|South Sudan|Juba
SD|Sudan|Khartoum
TZ|Tanzania|Dodoma
TG|Togo|Lomé
TN|Tunisia|Tunis
UG|Uganda|Kampala
ZM|Zambia|Lusaka
ZW|Zimbabwe|Harare`,
  Americas: `AG|Antigua and Barbuda|St. John's
AR|Argentina|Buenos Aires
BS|Bahamas|Nassau
BB|Barbados|Bridgetown
BZ|Belize|Belmopan
BO|Bolivia|Sucre
BR|Brazil|Brasília
CA|Canada|Ottawa
CL|Chile|Santiago
CO|Colombia|Bogotá
CR|Costa Rica|San José
CU|Cuba|Havana
DM|Dominica|Roseau
DO|Dominican Republic|Santo Domingo
EC|Ecuador|Quito
SV|El Salvador|San Salvador
GD|Grenada|St. George's
GT|Guatemala|Guatemala City
GY|Guyana|Georgetown
HT|Haiti|Port-au-Prince
HN|Honduras|Tegucigalpa
JM|Jamaica|Kingston
MX|Mexico|Mexico City
NI|Nicaragua|Managua
PA|Panama|Panama City
PY|Paraguay|Asunción
PE|Peru|Lima
KN|Saint Kitts and Nevis|Basseterre
LC|Saint Lucia|Castries
VC|Saint Vincent and the Grenadines|Kingstown
SR|Suriname|Paramaribo
TT|Trinidad and Tobago|Port of Spain
US|United States|Washington, D.C.
UY|Uruguay|Montevideo
VE|Venezuela|Caracas`,
  Asia: `AF|Afghanistan|Kabul
AM|Armenia|Yerevan
AZ|Azerbaijan|Baku
BH|Bahrain|Manama
BD|Bangladesh|Dhaka
BT|Bhutan|Thimphu
BN|Brunei|Bandar Seri Begawan
KH|Cambodia|Phnom Penh
CN|China|Beijing
GE|Georgia|Tbilisi
IN|India|New Delhi
ID|Indonesia|Jakarta
IR|Iran|Tehran
IQ|Iraq|Baghdad
IL|Israel|Jerusalem
JP|Japan|Tokyo
JO|Jordan|Amman
KZ|Kazakhstan|Astana
KW|Kuwait|Kuwait City
KG|Kyrgyzstan|Bishkek
LA|Laos|Vientiane
LB|Lebanon|Beirut
MY|Malaysia|Kuala Lumpur
MV|Maldives|Malé
MN|Mongolia|Ulaanbaatar
MM|Myanmar|Naypyidaw
NP|Nepal|Kathmandu
KP|North Korea|Pyongyang
OM|Oman|Muscat
PK|Pakistan|Islamabad
PH|Philippines|Manila
QA|Qatar|Doha
SA|Saudi Arabia|Riyadh
SG|Singapore|Singapore
KR|South Korea|Seoul
LK|Sri Lanka|Sri Jayawardenepura Kotte
SY|Syria|Damascus
TJ|Tajikistan|Dushanbe
TH|Thailand|Bangkok
TL|Timor-Leste|Dili
TR|Turkey|Ankara
TM|Turkmenistan|Ashgabat
AE|United Arab Emirates|Abu Dhabi
UZ|Uzbekistan|Tashkent
VN|Vietnam|Hanoi
YE|Yemen|Sanaa`,
  Europe: `AL|Albania|Tirana
AD|Andorra|Andorra la Vella
AT|Austria|Vienna
BY|Belarus|Minsk
BE|Belgium|Brussels
BA|Bosnia and Herzegovina|Sarajevo
BG|Bulgaria|Sofia
HR|Croatia|Zagreb
CY|Cyprus|Nicosia
CZ|Czechia|Prague
DK|Denmark|Copenhagen
EE|Estonia|Tallinn
FI|Finland|Helsinki
FR|France|Paris
DE|Germany|Berlin
GR|Greece|Athens
HU|Hungary|Budapest
IS|Iceland|Reykjavík
IE|Ireland|Dublin
IT|Italy|Rome
LV|Latvia|Riga
LI|Liechtenstein|Vaduz
LT|Lithuania|Vilnius
LU|Luxembourg|Luxembourg
MT|Malta|Valletta
MD|Moldova|Chișinău
MC|Monaco|Monaco
ME|Montenegro|Podgorica
NL|Netherlands|Amsterdam
MK|North Macedonia|Skopje
NO|Norway|Oslo
PL|Poland|Warsaw
PT|Portugal|Lisbon
RO|Romania|Bucharest
RU|Russia|Moscow
SM|San Marino|San Marino
RS|Serbia|Belgrade
SK|Slovakia|Bratislava
SI|Slovenia|Ljubljana
ES|Spain|Madrid
SE|Sweden|Stockholm
CH|Switzerland|Bern
UA|Ukraine|Kyiv
GB|United Kingdom|London
VA|Vatican City|Vatican City`,
  Oceania: `AU|Australia|Canberra
FJ|Fiji|Suva
KI|Kiribati|South Tarawa
MH|Marshall Islands|Majuro
FM|Micronesia|Palikir
NR|Nauru|Yaren
NZ|New Zealand|Wellington
PW|Palau|Ngerulmud
PG|Papua New Guinea|Port Moresby
WS|Samoa|Apia
SB|Solomon Islands|Honiara
TO|Tonga|Nukuʻalofa
TV|Tuvalu|Funafuti
VU|Vanuatu|Port Vila`,
}

export const REGIONS = Object.keys(RAW) as Region[]

export const COUNTRIES: Country[] = REGIONS.flatMap((region) =>
  RAW[region].split('\n').map((line) => {
    const [code, name, capital] = line.split('|')
    return { code, name, capital, region }
  }),
)
