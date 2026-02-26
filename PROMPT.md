**Technisch Beheer**

Kun je een webapp voor me maken genaamd “Technisch Beheer”. Deze app zal alle werkzaamheden voor de afdeling Technisch Beheer registreren. De afdeling Technisch Beheer bestaat uit de volgende subafdelingen: Automontage, Bouw, Electra, Koeltechniek, GaWaSa, Transport.

**Automontage**

De pagina Automontage houdt de reparatie van voertuigen bij, gerangschikt naar kentekennummer. De app moet een weergave geven van alle voertuigen en per voertuig individueel alle reparaties registreren in een detailpagina. Per voertuig moet in de detailpagina ook worden weergegeven wat het voertuig sinds de registratie heeft gekost. Ook welke onderdelen er tijdens de reparatie zijn gebruikt en wat ze hebben gekost. Dus een zogenoemd voertuigenpaspoort.

De verschillende redenen waarom een voertuig binnenkomt kunnen zijn, reparatie, service of diagnose.

Bij het registreren van de voertuigen is van belang aan te geven inzet (dropdown: Dienstplaat of Burgerplaat), het Kentekennummer, Structuur (dropdown fetcht info uit de pagina Organisatie), Afdeling (dropdown fetcht info uit Structuren van de pagina Organisatie. Afdeling kan pas worden ingevuld als Structuur is gekozen), Merk, Model, Bouwjaar, Soort (Sedan, Pickup, Bus, Truck, Station, SUV), Transmissie (Automaat of Manual), Aandrijving (4WD of 2WD), Chassisnummer. De voertuigen moeten ook een status hebben van defect, slecht, redelijk, goed. Nieuwe voertuigen worden eenmalig geregistreerd in een tabel.
Voeg in hetzelfde formulier een sectie toe genaamd Verzekering, met hieronder: Verzekerd bij(dropdown: “Self-Reliance”, “Assuria”, “Parsasco”, “Fatum”), Polisnummer, Verzekertype (dropdown: WA, Mini Casco, Casco), Verzekering geldig van, Verzekering gelding tot, Opmerking. Aan de bovenzijde van de tabel moet je een knop plaatsen genaamd kolommen (waar de gebruiker kan bepalen om kolommen te verbergen of weergeven).

Het kentekennummer moet bij registratie altijd een check doen in de database als het uniek is. Kentekennummers kunnen in drie formatten zijn:

1. twee letters, een koppelteken, twee cijfers, een koppelteken, twee cijfers, bijv.: PA-00-00
2. twee cijfers, een koppelteken, twee cijfers, een spatie, twee letters, bijv.: 00-00 AP
3. vier cijfers, een koppelteken, de letter D, bijv.: 0000-D

Indien burgerplaat is geselecteerd, dan kan de input van de kentekenplaat zijn format 1 of format 2. Indien dienstplaat is geselecteerd, dan kan de input uitsluitend zijn format 3.

Voertuigen die voor reparatie komen, worden geselecteerd uit een dropdown van vooraf geregistreerde voertuigen.

**Reparaties**
Bij het toevoegen van een nieuwe reparatie op de pagina VehicleDetail zijn de volgende velden belangrijk: 
•	Kentekennummer, Merk en Model (fetch uit de pagina VehicleManagement. Na het selecteren van het kentekennummer worden de velden Merk en Model automatisch ingevuld)
•	Datum
•	Werkzaamheden (dropdown: Reparatie, Service, Diagnose)
•	Beschrijving van werkzaamheden
Bij het toevoegen van onderdelen moeten de onderdelen in een dropdown worden gefetcht uit de pagina PartsManagement, waarbij de beschrijving, indien beschikbaar tussen haakjes achter het onderdeel komt te staan.
Plaats in de open reparatie ook een knop afgehandeld. Als op de knop afgehandeld wordt geklikt, veranderd de status van de reparatie van "In behandeling" naar "Afgehandeld". Voeg daarbij ook de datum toe waarop de status is veranderd naar afgehandeld. Voeg ook de mogelijkheid toe om de reparatie te kunnen bewerken.
Plaats ook een zoekbar op deze pagina. Bij het zoeken op kentekenplaat maakt het niet uit als het format juist is. Als het voertuig bijvoorbeeld is geregistreerd op Kentekennummer PA-21-01 en de gebruiker zoekt 2101  of pa2101, moet het resultaat van PA-21-01 gewoon worden getoond. Breidt de zoekfunctie uit om ook te zoeken op merk, model, structuur of afdeling.


**Bouw, Electra, Koeltechniek, GaWaSa, Transport**

Voor de afdelingen Bouw, Electra, Koeltechniek, GaWaSa, Transport kun je een pagina maken met een dropdown Bouw, Electra, Koeltechniek, GaWaSa, Transport. Hiervoor zijn de volgende gegevens belangrijk: structuur (dropdown fetcht info uit de pagina organisatie), afdeling (dropdown fetcht info uit structuren van de pagina organisatie. Afdeling kan pas worden ingevuld als structuur is gekozen), datum melding, melding, datum aanpak, aard van de werkzaamheden, status(in behandeling, afgehandeld), datum afgehandeld.

Maak een pagina genaamd Brands. Op deze pagina zullen de merken van autos worden opgeslagen. Elk merk heeft meerdere modellen. Deze pagina heeft dezelfde werking als de pagina Organisatie.

Maak een pagina genaamd PartsManagement. Op deze pagina kunnen auto onderdelen worden toegevoegd met optionele beschrijving. Bijvoorbeeld: Stuurbal, Links.

De app moet een sticky navbar hebben, met aan de linkerzijde een Home icoontje. Alle knoppen op de navbar moeten een relavante Lucide-react icoon krijgen. Aan de onderzijde een footer met daarin “Technisch Beheer KPS 2026. Powered by: A. Levens””. v1.0.0 (fetch de versie info uit de package.json file).

De app moet ook een dashboard hebben met stat cards en laatst verrichte werkzaamheden. Maak de app helemaal in dark mode.

Gebruik het bestand TECHNICAL\_ARCHITECTURE.md als referentie voor de technische architectuur van de app.