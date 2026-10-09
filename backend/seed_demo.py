"""Demo data: 120 approved companies, 500+ distinct products (each company lists 10-12, so many products
are offered by several companies and show up once on the Products page with a supplier count).

    python seed_demo.py          # add demo data (safe to re-run)
    python seed_demo.py --clear  # remove only the demo data

Demo supplier logins: demo001@demo.pharmaconnect.in ... demo120@... / password  Demo@12345
"""
import random
import sys
from sqlalchemy import select
from app.db.base import SessionLocal
from app.models import (ActiveStatus, Category, Company, CompanyStatus, Location, LocationType, Product,
                        ProductStatus, RequirementStatus, Requirement, Lead, Role, User)
from app.core.security import hash_password
from app.services.slugs import slugify

DOMAIN = "demo.pharmaconnect.in"
N_COMPANIES = 120
random.seed(42)

# molecule | form:strength,strength ; form:strength ...   (category tag at the end)
RAW = """
Paracetamol|Tablet:500mg,650mg,1000mg;Syrup:125mg/5ml,250mg/5ml;Injection:150mg/ml|G
Ibuprofen|Tablet:200mg,400mg,600mg;Syrup:100mg/5ml;Gel:5%|G
Diclofenac|Tablet:50mg,100mg SR;Gel:1%;Injection:75mg/3ml|G
Aceclofenac|Tablet:100mg,200mg SR;Gel:1.5%|G
Nimesulide|Tablet:100mg;Syrup:50mg/5ml;Gel:1%|G
Etoricoxib|Tablet:60mg,90mg,120mg|G
Naproxen|Tablet:250mg,500mg|G
Tramadol|Capsule:50mg;Injection:50mg/ml|G
Amoxicillin|Capsule:250mg,500mg;Syrup:125mg/5ml,250mg/5ml;Powder:250mg dry syrup|G
Amoxicillin + Clavulanic Acid|Tablet:375mg,625mg,1000mg;Syrup:228.5mg/5ml;Injection:1.2g|G
Azithromycin|Tablet:250mg,500mg;Syrup:200mg/5ml;Powder:100mg/5ml dry syrup|G
Clarithromycin|Tablet:250mg,500mg|G
Cefixime|Tablet:100mg,200mg,400mg;Syrup:50mg/5ml,100mg/5ml;Powder:100mg dry syrup|G
Cefpodoxime|Tablet:100mg,200mg;Syrup:50mg/5ml|G
Cefuroxime|Tablet:250mg,500mg;Injection:750mg|G
Ceftriaxone|Injection:250mg,500mg,1g,2g|G
Cefadroxil|Capsule:250mg,500mg;Syrup:125mg/5ml|G
Ciprofloxacin|Tablet:250mg,500mg,750mg;Drops:0.3%|G
Levofloxacin|Tablet:250mg,500mg,750mg;Injection:500mg/100ml|G
Ofloxacin|Tablet:200mg,400mg;Drops:0.3%|G
Ofloxacin + Ornidazole|Tablet:200mg+500mg;Syrup:50mg+125mg/5ml|G
Metronidazole|Tablet:200mg,400mg;Syrup:200mg/5ml;Gel:1%|G
Doxycycline|Capsule:100mg;Tablet:100mg|G
Linezolid|Tablet:600mg;Injection:600mg/300ml|G
Fluconazole|Tablet:50mg,150mg,200mg;Syrup:50mg/5ml|G
Itraconazole|Capsule:100mg,200mg|G
Terbinafine|Tablet:250mg;Cream:1%|D
Clotrimazole|Cream:1%;Powder:1% dusting;Drops:1% ear|D
Ketoconazole|Cream:2%;Shampoo:2%;Tablet:200mg|D
Luliconazole|Cream:1%;Lotion:1%|D
Mupirocin|Ointment:2%|D
Fusidic Acid|Cream:2%|D
Betamethasone|Cream:0.05%;Lotion:0.05%;Ointment:0.1%|D
Clobetasol|Cream:0.05%;Ointment:0.05%;Lotion:0.05%|D
Mometasone|Cream:0.1%;Lotion:0.1%|D
Tacrolimus|Ointment:0.03%,0.1%|D
Permethrin|Cream:5%;Lotion:1%|D
Adapalene|Gel:0.1%,0.3%|D
Benzoyl Peroxide|Gel:2.5%,5%|D
Tretinoin|Cream:0.025%,0.05%|D
Isotretinoin|Capsule:10mg,20mg|D
Hydroquinone|Cream:2%,4%|D
Sunscreen SPF 50|Lotion:50ml;Gel:50g|D
Omeprazole|Capsule:10mg,20mg,40mg|G
Pantoprazole|Tablet:20mg,40mg;Injection:40mg|G
Rabeprazole|Tablet:10mg,20mg|G
Esomeprazole|Tablet:20mg,40mg;Capsule:40mg|G
Esomeprazole + Domperidone|Capsule:40mg+30mg SR|G
Pantoprazole + Domperidone|Capsule:40mg+30mg SR|G
Ranitidine|Tablet:150mg,300mg|G
Domperidone|Tablet:10mg;Syrup:1mg/ml|G
Ondansetron|Tablet:4mg,8mg;Syrup:2mg/5ml;Injection:4mg/2ml|G
Levosulpiride|Tablet:25mg,75mg|G
Sucralfate|Syrup:1g/10ml;Tablet:1g|G
Antacid Gel|Syrup:170ml;Powder:sachets|G
Lactulose|Syrup:10g/15ml|G
Bisacodyl|Tablet:5mg|G
Racecadotril|Capsule:100mg;Powder:10mg sachet|G
ORS|Powder:WHO formula|P
Probiotic (Lactobacillus)|Capsule:5 billion CFU;Powder:sachet|N
Cetirizine|Tablet:5mg,10mg;Syrup:5mg/5ml|G
Levocetirizine|Tablet:5mg;Syrup:2.5mg/5ml|G
Fexofenadine|Tablet:60mg,120mg,180mg|G
Montelukast|Tablet:4mg,5mg,10mg|P
Montelukast + Levocetirizine|Tablet:10mg+5mg;Syrup:4mg+2.5mg/5ml|P
Salbutamol|Tablet:2mg,4mg;Syrup:2mg/5ml|P
Levosalbutamol|Syrup:1mg/5ml;Drops:1mg/ml|P
Ambroxol|Syrup:30mg/5ml;Drops:15mg/ml;Tablet:30mg|P
Bromhexine|Syrup:4mg/5ml;Tablet:8mg|P
Dextromethorphan|Syrup:10mg/5ml|P
Guaifenesin|Syrup:100mg/5ml|P
Cough Syrup (Herbal)|Syrup:100ml,200ml|A
Theophylline|Tablet:100mg,200mg SR|P
Metformin|Tablet:500mg,850mg,1000mg SR|C
Glimepiride|Tablet:1mg,2mg,3mg|C
Gliclazide|Tablet:40mg,80mg,60mg MR|C
Glipizide|Tablet:5mg|C
Sitagliptin|Tablet:50mg,100mg|C
Vildagliptin|Tablet:50mg|C
Teneligliptin|Tablet:20mg|C
Pioglitazone|Tablet:15mg,30mg|C
Dapagliflozin|Tablet:5mg,10mg|C
Empagliflozin|Tablet:10mg,25mg|C
Voglibose|Tablet:0.2mg,0.3mg|C
Insulin Glargine|Injection:100IU/ml|C
Amlodipine|Tablet:2.5mg,5mg,10mg|C
Telmisartan|Tablet:20mg,40mg,80mg|C
Losartan|Tablet:25mg,50mg,100mg|C
Olmesartan|Tablet:20mg,40mg|C
Telmisartan + Amlodipine|Tablet:40mg+5mg|C
Metoprolol|Tablet:25mg,50mg,100mg|C
Atenolol|Tablet:25mg,50mg,100mg|C
Bisoprolol|Tablet:2.5mg,5mg|C
Ramipril|Capsule:2.5mg,5mg,10mg|C
Enalapril|Tablet:2.5mg,5mg|C
Hydrochlorothiazide|Tablet:12.5mg,25mg|C
Furosemide|Tablet:20mg,40mg;Injection:20mg/2ml|C
Spironolactone|Tablet:25mg,50mg|C
Atorvastatin|Tablet:10mg,20mg,40mg,80mg|C
Rosuvastatin|Tablet:5mg,10mg,20mg,40mg|C
Fenofibrate|Tablet:145mg,160mg|C
Clopidogrel|Tablet:75mg|C
Aspirin|Tablet:75mg,150mg|C
Aspirin + Clopidogrel|Capsule:75mg+75mg|C
Ticagrelor|Tablet:60mg,90mg|C
Warfarin|Tablet:1mg,2mg,5mg|C
Isosorbide Mononitrate|Tablet:10mg,20mg,30mg ER|C
Trimetazidine|Tablet:20mg,35mg MR|C
Ivabradine|Tablet:5mg,7.5mg|C
Ranolazine|Tablet:500mg,1000mg ER|C
Levothyroxine|Tablet:25mcg,50mcg,75mcg,100mcg|G
Carbimazole|Tablet:5mg,10mg|G
Prednisolone|Tablet:5mg,10mg,20mg;Syrup:5mg/5ml|G
Methylprednisolone|Tablet:4mg,8mg,16mg|G
Dexamethasone|Tablet:0.5mg,4mg;Injection:4mg/ml|G
Deflazacort|Tablet:6mg,12mg,30mg|P
Alprazolam|Tablet:0.25mg,0.5mg|G
Clonazepam|Tablet:0.25mg,0.5mg,1mg|G
Escitalopram|Tablet:5mg,10mg,20mg|G
Sertraline|Tablet:25mg,50mg,100mg|G
Fluoxetine|Capsule:10mg,20mg|G
Amitriptyline|Tablet:10mg,25mg|G
Gabapentin|Capsule:100mg,300mg,400mg|G
Pregabalin|Capsule:50mg,75mg,150mg|G
Pregabalin + Methylcobalamin|Capsule:75mg+750mcg|G
Levetiracetam|Tablet:250mg,500mg,750mg|G
Sodium Valproate|Tablet:200mg,300mg,500mg CR|G
Carbamazepine|Tablet:100mg,200mg,400mg CR|G
Phenytoin|Tablet:50mg,100mg|G
Donepezil|Tablet:5mg,10mg|G
Piracetam|Tablet:400mg,800mg,1200mg;Syrup:500mg/5ml|G
Folic Acid|Tablet:1mg,5mg|M
Methylcobalamin|Tablet:500mcg,1500mcg;Injection:1500mcg/ml|M
Vitamin B-Complex|Capsule:with Zinc;Syrup:200ml|M
Vitamin D3|Capsule:60000IU;Drops:400IU/ml;Syrup:200ml|M
Calcium + Vitamin D3|Tablet:500mg+250IU;Tablet:1000mg+500IU|M
Calcium Citrate + Magnesium|Tablet:with Zinc|M
Iron + Folic Acid|Tablet:100mg+500mcg;Syrup:150ml|M
Ferrous Ascorbate|Tablet:100mg;Syrup:100mg/5ml|M
Iron Sucrose|Injection:100mg/5ml|M
Zinc Sulphate|Tablet:20mg dispersible;Syrup:20mg/5ml|M
Multivitamin + Multimineral|Capsule:Adults;Syrup:Pediatric|M
Omega-3 Fatty Acids|Capsule:500mg,1000mg|M
Vitamin C|Tablet:500mg chewable|M
Vitamin E|Capsule:200mg,400mg|M
Biotin|Tablet:5mg,10mg|M
L-Carnitine|Syrup:500mg/5ml;Tablet:500mg|M
Protein Powder|Powder:200g,400g,1kg|N
Ashwagandha|Capsule:300mg,500mg;Tablet:500mg|A
Giloy|Tablet:500mg;Syrup:200ml|A
Triphala|Tablet:500mg;Powder:100g|A
Tulsi|Drops:30ml;Capsule:400mg|A
Neem|Capsule:500mg;Soap:75g|A
Amla|Juice:500ml;Capsule:500mg|A
Shatavari|Capsule:500mg;Powder:100g|A
Liv Tonic (Herbal)|Syrup:200ml,450ml|A
Joint Pain Oil (Herbal)|Oil:100ml|A
Chyawanprash|Powder:500g,1kg|A
Silymarin|Tablet:70mg,140mg|A
Ursodeoxycholic Acid|Tablet:150mg,300mg|G
Norethisterone|Tablet:5mg|W
Progesterone|Capsule:100mg,200mg,400mg|W
Dydrogesterone|Tablet:10mg|W
Letrozole|Tablet:2.5mg,5mg|W
Clomiphene|Tablet:50mg,100mg|W
Tranexamic Acid|Tablet:250mg,500mg;Injection:500mg/5ml|W
Mefenamic Acid|Tablet:250mg,500mg;Syrup:100mg/5ml|W
Drotaverine|Tablet:40mg,80mg|W
Misoprostol|Tablet:200mcg|W
Clotrimazole Pessary|Tablet:100mg,200mg|W
Raloxifene|Tablet:60mg|W
Sildenafil|Tablet:25mg,50mg,100mg|G
Tadalafil|Tablet:5mg,10mg,20mg|G
Tamsulosin|Capsule:0.2mg,0.4mg|G
Finasteride|Tablet:1mg,5mg|G
Dutasteride|Capsule:0.5mg|G
Allopurinol|Tablet:100mg,300mg|G
Febuxostat|Tablet:40mg,80mg|G
Colchicine|Tablet:0.5mg|G
Alendronate|Tablet:70mg|M
Chlorhexidine|Mouthwash:0.2%;Gel:1%|G
Povidone Iodine|Ointment:5%;Solution:5%,10%|G
Moxifloxacin|Drops:0.5%;Tablet:400mg|G
Tobramycin|Drops:0.3%;Ointment:0.3%|G
Carboxymethylcellulose|Drops:0.5%,1%|G
Timolol|Drops:0.5%|G
Latanoprost|Drops:0.005%|G
Olopatadine|Drops:0.1%|G
Xylometazoline|Drops:0.05%,0.1%|G
Oxymetazoline|Drops:0.025%,0.05%|G
Ofloxacin Ear Drops|Drops:0.3%|G
Albendazole|Tablet:400mg;Syrup:200mg/5ml|G
Ivermectin|Tablet:3mg,6mg,12mg|G
Praziquantel|Tablet:600mg|G
Hydroxychloroquine|Tablet:200mg,400mg|G
Methotrexate|Tablet:2.5mg,7.5mg,10mg|G
Ceftriaxone + Sulbactam|Injection:1.5g|G
Piperacillin + Tazobactam|Injection:4.5g|G
Meropenem|Injection:500mg,1g|G
Amikacin|Injection:250mg,500mg|G
Gentamicin|Injection:80mg/2ml|G
Ondansetron + Rabeprazole|Tablet:combination|G
Veterinary Calcium|Syrup:Liquid 1L;Powder:1kg|V
Veterinary Multivitamin|Injection:30ml;Powder:1kg|V
Ivermectin (Veterinary)|Injection:1%;Tablet:bolus|V
Oxytetracycline (Veterinary)|Injection:20%;Powder:soluble|V
Albendazole (Veterinary)|Suspension:2.5%;Tablet:bolus 300mg|V
Meloxicam (Veterinary)|Injection:5mg/ml|V
Liver Tonic (Veterinary)|Liquid:1L;Powder:1kg|V
Poultry Probiotic|Powder:1kg|V
Cattle Mineral Mixture|Powder:1kg,5kg|V
Pediatric Vitamin Drops|Drops:15ml;Syrup:100ml|P
Gripe Water|Syrup:60ml,150ml|P
Infant Colic Drops|Drops:15ml|P
Diaper Rash Cream|Cream:50g|P
Pediatric Zinc + ORS Kit|Kit:combo|P
Pediatric Paracetamol Drops|Drops:100mg/ml|P
Pediatric Cough Syrup|Syrup:60ml,100ml|P
Cefixime + Ofloxacin|Tablet:200mg+200mg;Syrup:50mg+50mg/5ml|G
Cefixime + Azithromycin|Tablet:200mg+250mg|G
Amoxicillin + Dicloxacillin|Capsule:250mg+250mg|G
Nitrofurantoin|Capsule:100mg SR|G
Norfloxacin + Tinidazole|Tablet:400mg+600mg|G
Tinidazole|Tablet:300mg,500mg,1000mg|G
Rifaximin|Tablet:200mg,400mg,550mg|G
Mesalamine|Tablet:400mg,800mg|G
Hyoscine Butylbromide|Tablet:10mg;Injection:20mg/ml|G
Dicyclomine|Tablet:10mg,20mg;Syrup:10mg/5ml|G
Telmisartan + Hydrochlorothiazide|Tablet:40mg+12.5mg,80mg+12.5mg|C
Losartan + Hydrochlorothiazide|Tablet:50mg+12.5mg|C
Amlodipine + Atenolol|Tablet:5mg+50mg|C
Metformin + Glimepiride|Tablet:500mg+1mg,500mg+2mg|C
Metformin + Sitagliptin|Tablet:500mg+50mg,1000mg+50mg|C
Atorvastatin + Clopidogrel|Capsule:10mg+75mg,20mg+75mg|C
Atorvastatin + Aspirin|Capsule:10mg+75mg|C
Rosuvastatin + Fenofibrate|Tablet:10mg+160mg|C
Nebivolol|Tablet:2.5mg,5mg|C
Carvedilol|Tablet:3.125mg,6.25mg,12.5mg|C
Prazosin|Tablet:2.5mg,5mg|C
Digoxin|Tablet:0.25mg|C
Sacubitril + Valsartan|Tablet:50mg,100mg|C
Rivaroxaban|Tablet:10mg,15mg,20mg|C
Apixaban|Tablet:2.5mg,5mg|C
Acenocoumarol|Tablet:1mg,2mg|C
Zolpidem|Tablet:5mg,10mg|G
Melatonin|Tablet:3mg,5mg|N
Mirtazapine|Tablet:7.5mg,15mg|G
Olanzapine|Tablet:2.5mg,5mg,10mg|G
Risperidone|Tablet:1mg,2mg,4mg|G
Quetiapine|Tablet:25mg,50mg,100mg|G
Aripiprazole|Tablet:5mg,10mg|G
Propranolol|Tablet:10mg,20mg,40mg|G
Flunarizine|Tablet:5mg,10mg|G
Sumatriptan|Tablet:25mg,50mg|G
Betahistine|Tablet:8mg,16mg,24mg|G
Cinnarizine|Tablet:25mg,75mg|G
Glucosamine + Chondroitin|Tablet:1500mg+1200mg|N
Collagen Peptides|Powder:200g;Capsule:500mg|N
Coenzyme Q10|Capsule:100mg,200mg|N
Lycopene|Capsule:Antioxidant|N
Spirulina|Tablet:500mg;Capsule:500mg|N
Evening Primrose Oil|Capsule:500mg,1000mg|W
Myo-Inositol + Folic Acid|Tablet:Women health;Powder:sachet|W
Fluconazole + Clindamycin|Cream:Vaginal|W
Isoxsuprine|Tablet:10mg,20mg|W
Ormeloxifene|Tablet:30mg,60mg|W
Cabergoline|Tablet:0.25mg,0.5mg|W
Salicylic Acid|Ointment:3%,6%;Lotion:2%|D
Urea|Cream:10%,20%|D
Minoxidil|Lotion:2%,5%|D
Ketoconazole + Zinc Pyrithione|Shampoo:2%|D
Calamine|Lotion:100ml|D
Silver Sulfadiazine|Cream:1%|D
Neomycin + Bacitracin|Ointment:Antibiotic|D
Aloe Vera|Gel:Pure 100g|A
Kumari Asava|Syrup:450ml|A
Dashmularishta|Syrup:450ml|A
Arjuna|Capsule:500mg|A
Guggulu|Tablet:500mg|A
Brahmi|Capsule:500mg;Syrup:200ml|A
Moringa|Capsule:500mg;Powder:100g|A
Kutki|Capsule:500mg|A
Pediatric Multivitamin Gummies|Gummies:30 pieces|P
Pediatric Iron Syrup|Syrup:100ml|P
Pediatric Calcium Syrup|Syrup:200ml|P
Pediatric Antacid Drops|Drops:30ml|P
Poultry Liver Tonic|Liquid:1L|V
Poultry Electrolyte|Powder:1kg|V
Doxycycline (Veterinary)|Powder:soluble 1kg|V
Enrofloxacin (Veterinary)|Injection:10%;Liquid:10%|V
Levamisole (Veterinary)|Powder:soluble|V
Calcium Borogluconate (Veterinary)|Injection:450ml|V
""".strip().splitlines()

CAT_TAGS = {"G": ["PCD Pharma Franchise", "Pharmaceutical Manufacturing", "Third Party Manufacturing"],
            "D": ["Derma"], "A": ["Ayurvedic"], "V": ["Veterinary"], "N": ["Nutraceuticals"], "M": ["Nutraceuticals"],
            "P": ["Pediatric"], "W": ["Gynae"], "C": ["Cardiac / Diabetic"]}

FORM_PACKS = {
    "Tablet": ["10x10", "10x15", "10x10 Alu-Alu", "3x10", "1x10", "1x15"],
    "Capsule": ["10x10", "10x10 Alu-Alu", "1x10", "10x15"],
    "Syrup": ["60ml", "100ml", "200ml", "450ml"],
    "Powder": ["30g", "100g", "1kg", "10 sachets", "30ml bottle"],
    "Injection": ["1 vial", "10 vials", "1 ampoule", "5x1"],
    "Drops": ["10ml", "15ml", "30ml"],
    "Gel": ["15g", "30g", "50g"], "Cream": ["15g", "30g", "50g"], "Ointment": ["10g", "20g", "30g"],
}
FORM_MAP = {"Cream": "Ointment / Cream", "Ointment": "Ointment / Cream"}
KNOWN = {"Tablet", "Capsule", "Syrup", "Injection", "Ointment / Cream", "Drops", "Powder", "Gel"}


def build_catalog():
    items = []
    for line in RAW:
        mol, variants, tag = [x.strip() for x in line.split("|")]
        for v in variants.split(";"):
            form, strengths = v.split(":", 1)
            for st in strengths.split(","):
                name = f"{mol} {st.strip()} {form.strip()}"
                comp = f"{mol} {st.strip()}"
                df = FORM_MAP.get(form.strip(), form.strip())
                items.append(dict(name=name, composition=comp, dosage_form=df if df in KNOWN else "Other",
                                  form=form.strip(), tag=tag))
    seen, out = set(), []
    for it in items:
        if it["name"].lower() not in seen:
            seen.add(it["name"].lower()); out.append(it)
    return out


PREFIX = ["Zenith", "Medora", "Alkem", "Vitalis", "Sunrise", "Apex", "Nova", "Curewell", "Biogen", "Lifeline", "Aarogya",
          "Shree", "Om", "Ganga", "Himalaya", "Trident", "Veda", "Prime", "Aura", "Elite", "Orion", "Pinnacle", "Radiant",
          "Sanjeevani", "Unity", "Wellcare", "Evergreen", "Arcadia", "Bharat", "Cipla-X", "Dhanvantari", "Everest",
          "Fortune", "Globe", "Harmony", "Ideal", "Jeevan", "Kalyan", "Lotus", "Maxwell"]
SUFFIX = ["Pharma", "Lifesciences", "Healthcare", "Remedies", "Biotech", "Laboratories", "Formulations"]
FALLBACK_LOCS = {"Punjab": ["Chandigarh", "Ludhiana", "Dera Bassi", "Amritsar"], "Haryana": ["Panchkula", "Gurugram", "Baddi-Nalagarh"],
                 "Himachal Pradesh": ["Baddi", "Paonta Sahib", "Solan"], "Gujarat": ["Ahmedabad", "Vadodara", "Surat"],
                 "Maharashtra": ["Mumbai", "Pune", "Nashik"], "Uttarakhand": ["Haridwar", "Dehradun", "Roorkee"],
                 "Telangana": ["Hyderabad", "Warangal"], "Karnataka": ["Bengaluru", "Mysuru"], "Delhi": ["New Delhi"]}
TYPES = ["Manufacturer", "Third Party Manufacturer", "PCD Franchise Company", "Distributor", "Wholesaler"]
TYPE_W = [30, 25, 25, 12, 8]


def clear(db):
    users = db.scalars(select(User).where(User.email.like(f"%@{DOMAIN}"))).all()
    company_ids = [u.company.id for u in users if u.company]
    # Leads point at companies without a cascade, so remove the demo companies' leads first.
    leads = db.scalars(select(Lead).where(Lead.supplier_id.in_(company_ids))).all() if company_ids else []
    req_ids = {l.requirement_id for l in leads}
    for l in leads:
        db.delete(l)
    db.flush()
    for rid in req_ids:  # a requirement that lost its only lead goes back to the unassigned queue
        if not db.scalar(select(Lead.id).where(Lead.requirement_id == rid).limit(1)):
            r = db.get(Requirement, rid)
            if r and r.status == RequirementStatus.ASSIGNED:
                r.status = RequirementStatus.NEW
    for u in users:
        if u.company:
            db.delete(u.company)  # products cascade
    db.flush()
    for u in users:
        db.delete(u)
    db.commit()
    print(f"Removed {len(users)} demo suppliers, their companies/products and {len(leads)} lead(s).")


def ensure_locations(db):
    if db.scalar(select(Location.id).where(Location.type == LocationType.CITY).limit(1)):
        return
    print("No locations found - adding a small built-in set.")
    for st, cities in FALLBACK_LOCS.items():
        s = Location(name=st, slug=slugify(st), type=LocationType.STATE, status=ActiveStatus.ACTIVE)
        db.add(s); db.flush()
        for c in cities:
            db.add(Location(name=c, slug=slugify(f"{c}-{st}"), type=LocationType.CITY, parent_id=s.id, status=ActiveStatus.ACTIVE))
    db.commit()


def ensure_categories(db):
    if db.scalar(select(Category.id).limit(1)):
        return
    for n in {c for v in CAT_TAGS.values() for c in v}:
        db.add(Category(name=n, slug=slugify(n), status=ActiveStatus.ACTIVE))
    db.commit()


def main():
    with SessionLocal() as db:
        if "--clear" in sys.argv:
            return clear(db)
        if db.scalar(select(User.id).where(User.email.like(f"%@{DOMAIN}")).limit(1)):
            print("Demo data already present. Run with --clear first to rebuild it."); return
        ensure_locations(db); ensure_categories(db)
        locs = db.scalars(select(Location).where(Location.status == ActiveStatus.ACTIVE)).all()
        states = {l.id: l for l in locs if l.type == LocationType.STATE}
        cities = [l for l in locs if l.type == LocationType.CITY and l.parent_id in states]
        cats = {c.name: c for c in db.scalars(select(Category)).all()}

        catalog = build_catalog()
        print(f"Distinct products in catalog: {len(catalog)}")
        assert len(catalog) >= 500, "catalog too small"
        by_tag = {}
        for it in catalog:
            by_tag.setdefault(it["tag"], []).append(it)

        # every product is guaranteed to be used at least once, then the rest is random overlap
        order = catalog[:]; random.shuffle(order)
        guaranteed = [order[i::N_COMPANIES] for i in range(N_COMPANIES)]

        combos = [(p, s) for p in PREFIX for s in SUFFIX]; random.shuffle(combos)
        pw = hash_password("Demo@12345")
        n_rows = 0
        for i in range(N_COMPANIES):
            p, s = combos[i]
            name = f"{p} {s}"
            city = random.choice(cities); state = states[city.parent_id]
            btype = random.choices(TYPES, TYPE_W)[0]
            focus = random.sample("GGGDACMPWNV", 2)
            user = User(name=f"{p} Admin", email=f"demo{i + 1:03d}@{DOMAIN}", mobile=f"98{random.randint(10000000, 99999999)}",
                        password_hash=pw, role=Role.SUPPLIER)
            db.add(user); db.flush()
            co_cats = {c for t in focus for c in CAT_TAGS[t] if c in cats}
            comp = Company(user_id=user.id, name=name, slug=slugify(f"{name}-{city.name}"), business_type=btype,
                           description=f"{name} is a {btype.lower()} based in {city.name}, {state.name}, supplying quality "
                                       f"formulations to chemists, hospitals and distributors across India. WHO-GMP compliant facility "
                                       f"with a wide product portfolio.",
                           address=f"Plot {random.randint(1, 250)}, Industrial Area, {city.name}, {state.name}",
                           city_id=city.id, state_id=state.id, phone=user.mobile, email=user.email, status=CompanyStatus.APPROVED)
            comp.categories = [cats[c] for c in co_cats]
            db.add(comp); db.flush()

            want = random.randint(10, 12)
            chosen = {it["name"]: it for it in guaranteed[i]}
            pool = [it for t in focus for it in by_tag.get(t, [])]
            tries = 0
            while len(chosen) < want and tries < 500:
                it = random.choice(pool if random.random() < 0.8 else catalog); chosen.setdefault(it["name"], it); tries += 1
            for it in chosen.values():
                packs = FORM_PACKS.get(it["form"], ["1 unit"])
                db.add(Product(company_id=comp.id, name=it["name"], slug=slugify(f"{it['name']}-{name}")[:240],
                               composition=it["composition"], dosage_form=it["dosage_form"], pack_size=random.choice(packs),
                               description=f"{it['name']} manufactured by {name}.", status=ProductStatus.APPROVED))
                n_rows += 1
            if (i + 1) % 20 == 0:
                db.commit(); print(f"  {i + 1} companies...")
        db.commit()
        print(f"Done: {N_COMPANIES} companies, {n_rows} product listings, {len(catalog)} distinct products.")


if __name__ == "__main__":
    main()
