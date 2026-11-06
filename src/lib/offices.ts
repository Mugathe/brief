export const OFFICES = ["President", "Governor", "Senator", "Woman Representative", "Member of Parliament", "MCA"] as const;
export type Office = (typeof OFFICES)[number];

export const REGION_LABEL: Record<Office, string> = {
  President: "Nationwide",
  Governor: "County",
  Senator: "County",
  "Woman Representative": "County",
  "Member of Parliament": "Constituency",
  MCA: "Ward",
};

export const COUNTIES = [
  "Mombasa", "Kwale", "Kilifi", "Tana River", "Lamu", "Taita-Taveta", "Garissa", "Wajir", "Mandera", "Marsabit",
  "Isiolo", "Meru", "Tharaka-Nithi", "Embu", "Kitui", "Machakos", "Makueni", "Nyandarua", "Nyeri", "Kirinyaga",
  "Murang'a", "Kiambu", "Turkana", "West Pokot", "Samburu", "Trans Nzoia", "Uasin Gishu", "Elgeyo-Marakwet", "Nandi", "Baringo",
  "Laikipia", "Nakuru", "Narok", "Kajiado", "Kericho", "Bomet", "Kakamega", "Vihiga", "Bungoma", "Busia",
  "Siaya", "Kisumu", "Homa Bay", "Migori", "Kisii", "Nyamira", "Nairobi",
] as const;
