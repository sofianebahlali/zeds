#!/usr/bin/env python3
"""
Build futcard.json from Kaggle FUT datasets + curated META player lists.
Uses datasets for accurate stats, curated list for META card selection.
"""

import csv
import json
import unicodedata
import os

DATASETS = {
    "FIFA 21": "/tmp/futdata21/Fifa 21 Fut Players.csv",
    "FIFA 23": "/tmp/futdata23/FIFA_23_Fut_Players.csv",
    "FC 24": "/tmp/futdata/EA_FC_24_Fut_Players.csv",
}

OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "questions", "futcard.json")

# ==========================================
# CURATED META CARDS PER EDITION
# Format: (player_name_in_dataset, preferred_version_keyword_or_None, club_override, country_override)
# version=None means "any version" (will pick highest rated or gold rare)
# ==========================================

META_CARDS = {
    "FIFA 21": [
        # The defense meta
        ("Raphaël Varane", "Gold Rare", "Real Madrid", "France"),
        ("Ferland Mendy", "Gold Rare", "Real Madrid", "France"),
        ("Joe Gomez", "Gold Rare", "Liverpool", "England"),
        ("Kyle Walker", "Gold Rare", "Manchester City", "England"),
        ("Nick Pope", "Gold Rare", "Burnley", "England"),
        # Attack meta
        ("Kylian Mbappé", "Gold Rare", "Paris Saint-Germain", "France"),
        ("Neymar Jr", "Gold Rare", "Paris Saint-Germain", "Brazil"),
        ("Marcus Rashford", "Gold Rare", "Manchester United", "England"),
        ("Cristiano Ronaldo", "Gold Rare", "Piemonte Calcio", "Portugal"),
        # Midfield meta
        ("N'Golo Kanté", "Gold Rare", "Chelsea", "France"),
        ("Renato Sanches", "Gold Rare", "Lille", "Portugal"),
        ("Moussa Sissoko", "Gold Rare", "Tottenham Hotspur", "France"),
        ("Allan", "Gold Rare", "Everton", "Brazil"),
        # Special cards
        ("Adama Traoré", None, "Wolverhampton", "Spain"),
        ("Ousmane Dembélé", "Gold Rare", "FC Barcelona", "France"),
        ("Wissam Ben Yedder", None, "AS Monaco", "France"),
        ("Heung Min Son", "Gold Rare", "Tottenham Hotspur", "South Korea"),
        ("Sadio Mané", "Gold Rare", "Liverpool", "Senegal"),
        ("Samuel Eto'o", None, "Icons", "Cameroon"),
        ("Patrick Vieira", None, "Icons", "France"),
        ("Pelé", None, "Icons", "Brazil"),
        ("Eusébio", None, "Icons", "Portugal"),
        ("Ruud Gullit", None, "Icons", "Netherlands"),
        # Cheap beasts
        ("Rodrigo", "Gold Rare", "Leeds United", "Spain"),
        ("Lucas Moura", "Gold Rare", "Tottenham Hotspur", "Brazil"),
        ("Eder Militão", "Gold Rare", "Real Madrid", "Brazil"),
        # SBCs that everyone did
        ("Jesse Lingard", None, "West Ham United", "England"),
        ("Wayne Rooney", None, "D.C. United", "England"),
        ("Paulo Dybala", None, "Piemonte Calcio", "Argentina"),
        ("David Beckham", None, "Icons", "England"),
    ],
    "FIFA 23": [
        # Attack meta
        ("Kylian Mbappé", "Gold Rare", "Paris Saint-Germain", "France"),
        ("Erling Haaland", "Gold Rare", "Manchester City", "Norway"),
        ("Neymar Jr", "Gold Rare", "Paris Saint-Germain", "Brazil"),
        ("Ousmane Dembélé", "Gold Rare", "FC Barcelona", "France"),
        ("Vinícius Jr.", "Gold Rare", "Real Madrid", "Brazil"),
        # Early game meta
        ("Arnaut Danjuma", "Gold Rare", "Villarreal", "Netherlands"),
        ("Rafael Leão", "Gold Rare", "AC Milan", "Portugal"),
        ("Allan Saint-Maximin", "Gold Rare", "Newcastle", "France"),
        ("Kingsley Coman", "Gold Rare", "Bayern Munich", "France"),
        ("Wissam Ben Yedder", None, "AS Monaco", "France"),
        # Defense meta
        ("Eder Militão", "Gold Rare", "Real Madrid", "Brazil"),
        ("Jules Koundé", "Gold Rare", "FC Barcelona", "France"),
        ("Marquinhos", "Gold Rare", "Paris Saint-Germain", "Brazil"),
        ("Theo Hernández", "Gold Rare", "AC Milan", "France"),
        ("Ferland Mendy", "Gold Rare", "Real Madrid", "France"),
        # Midfield
        ("N'Golo Kanté", "Gold Rare", "Chelsea", "France"),
        ("Luka Modrić", "Gold Rare", "Real Madrid", "Croatia"),
        ("Franck Kessié", "Gold Rare", "FC Barcelona", "Ivory Coast"),
        ("Aurélien Tchouaméni", "Gold Rare", "Real Madrid", "France"),
        # Icons / Heroes
        ("Ruud Gullit", None, "Icons", "Netherlands"),
        ("Ronaldo", None, "Icons", "Brazil"),
        ("Zinedine Zidane", None, "Icons", "France"),
        ("Thierry Henry", None, "Icons", "France"),
        ("Al-Owairan", None, "Heroes", "Saudi Arabia"),
        # Popular special cards
        ("Gareth Bale", None, "Los Angeles FC", "Wales"),
        ("Ángel Di María", None, "Juventus", "Argentina"),
        ("Cristiano Ronaldo", None, "Al Nassr", "Portugal"),
        ("Lionel Messi", None, "Paris Saint-Germain", "Argentina"),
        ("Mohamed Salah", "Gold Rare", "Liverpool", "Egypt"),
        ("Sadio Mané", "Gold Rare", "Bayern Munich", "Senegal"),
    ],
    "FC 24": [
        # Attack
        ("Kylian Mbappé", "Gold Rare", "Paris Saint-Germain", "France"),
        ("Erling Haaland", "Gold Rare", "Manchester City", "Norway"),
        ("Vinícius Jr.", "Gold Rare", "Real Madrid", "Brazil"),
        ("Mohamed Salah", "Gold Rare", "Liverpool", "Egypt"),
        ("Heung Min Son", "Gold Rare", "Tottenham Hotspur", "South Korea"),
        ("Ousmane Dembélé", "Gold Rare", "Paris Saint-Germain", "France"),
        ("Moussa Diaby", "Gold Rare", "Aston Villa", "France"),
        ("Marcus Rashford", "Gold Rare", "Manchester United", "England"),
        ("Lautaro Martínez", "Gold Rare", "Inter Milan", "Argentina"),
        # Midfield
        ("Jude Bellingham", "Gold Rare", "Real Madrid", "England"),
        ("Kevin De Bruyne", "Gold Rare", "Manchester City", "Belgium"),
        ("Luka Modrić", "Gold Rare", "Real Madrid", "Croatia"),
        ("N'Golo Kanté", "Gold Rare", "Al Ittihad", "France"),
        ("Federico Valverde", "Gold Rare", "Real Madrid", "Uruguay"),
        ("Aurélien Tchouaméni", "Gold Rare", "Real Madrid", "France"),
        # Defense
        ("Virgil van Dijk", "Gold Rare", "Liverpool", "Netherlands"),
        ("Rúben Dias", "Gold Rare", "Manchester City", "Portugal"),
        ("Antonio Rüdiger", "Gold Rare", "Real Madrid", "Germany"),
        ("Theo Hernández", "Gold Rare", "AC Milan", "France"),
        ("Ferland Mendy", "Gold Rare", "Real Madrid", "France"),
        # GK
        ("Thibaut Courtois", "Gold Rare", "Real Madrid", "Belgium"),
        ("Gianluigi Donnarumma", "Gold Rare", "Paris Saint-Germain", "Italy"),
        # Icons
        ("Zinedine Zidane", None, "Icons", "France"),
        ("Ronaldo", None, "Icons", "Brazil"),
        ("Ronaldinho", None, "Icons", "Brazil"),
        ("Thierry Henry", None, "Icons", "France"),
        ("George Best", None, "Icons", "Northern Ireland"),
        # Special popular cards
        ("Rodrygo", None, "Real Madrid", "Brazil"),
        ("Thiago Silva", None, "Chelsea", "Brazil"),
        ("Cristiano Ronaldo", None, "Al Nassr", "Portugal"),
    ],
}

# ==========================================
# HARDCODED META CARDS (FIFA 17, 18, 19, 20 - no Kaggle datasets available)
# ==========================================

HARDCODED_CARDS = [
    # FIFA 17
    {"playerName": "Anthony Martial", "cardType": "gold_rare", "fifaEdition": "FIFA 17", "rating": 82, "position": "LF", "nationality": "France", "club": "Manchester United", "stats": {"pac": 92, "sho": 78, "pas": 73, "dri": 84, "def": 33, "phy": 72}, "difficulty": "easy"},
    {"playerName": "Ahmed Musa", "cardType": "gold_rare", "fifaEdition": "FIFA 17", "rating": 75, "position": "ST", "nationality": "Nigeria", "club": "Leicester City", "stats": {"pac": 96, "sho": 70, "pas": 56, "dri": 79, "def": 22, "phy": 63}, "difficulty": "medium"},
    {"playerName": "Jack Butland", "cardType": "gold_rare", "fifaEdition": "FIFA 17", "rating": 82, "position": "GK", "nationality": "England", "club": "Stoke City", "stats": {"pac": 42, "sho": 0, "pas": 55, "dri": 14, "def": 18, "phy": 80}, "difficulty": "medium"},
    {"playerName": "Chris Smalling", "cardType": "gold_rare", "fifaEdition": "FIFA 17", "rating": 84, "position": "CB", "nationality": "England", "club": "Manchester United", "stats": {"pac": 72, "sho": 42, "pas": 53, "dri": 53, "def": 83, "phy": 85}, "difficulty": "medium"},
    {"playerName": "Renato Sanches", "cardType": "gold_rare", "fifaEdition": "FIFA 17", "rating": 78, "position": "CM", "nationality": "Portugal", "club": "Bayern Munich", "stats": {"pac": 86, "sho": 69, "pas": 68, "dri": 78, "def": 68, "phy": 80}, "difficulty": "medium"},
    {"playerName": "N'Golo Kanté", "cardType": "gold_rare", "fifaEdition": "FIFA 17", "rating": 83, "position": "CDM", "nationality": "France", "club": "Chelsea", "stats": {"pac": 82, "sho": 55, "pas": 72, "dri": 78, "def": 82, "phy": 76}, "difficulty": "easy"},
    {"playerName": "Alexandre Lacazette", "cardType": "sbc", "fifaEdition": "FIFA 17", "rating": 90, "position": "ST", "nationality": "France", "club": "Olympique Lyonnais", "stats": {"pac": 88, "sho": 89, "pas": 75, "dri": 88, "def": 39, "phy": 73}, "difficulty": "medium"},
    {"playerName": "Son Heung-min", "cardType": "potm", "fifaEdition": "FIFA 17", "rating": 84, "position": "LM", "nationality": "South Korea", "club": "Tottenham Hotspur", "stats": {"pac": 89, "sho": 85, "pas": 77, "dri": 85, "def": 42, "phy": 68}, "difficulty": "easy"},
    {"playerName": "Kyle Walker", "cardType": "gold_rare", "fifaEdition": "FIFA 17", "rating": 82, "position": "RB", "nationality": "England", "club": "Tottenham Hotspur", "stats": {"pac": 94, "sho": 50, "pas": 66, "dri": 72, "def": 76, "phy": 77}, "difficulty": "medium"},
    {"playerName": "Eric Bailly", "cardType": "gold_rare", "fifaEdition": "FIFA 17", "rating": 80, "position": "CB", "nationality": "Ivory Coast", "club": "Manchester United", "stats": {"pac": 80, "sho": 36, "pas": 46, "dri": 51, "def": 80, "phy": 82}, "difficulty": "medium"},
    {"playerName": "Moussa Dembélé", "cardType": "gold_rare", "fifaEdition": "FIFA 17", "rating": 82, "position": "CM", "nationality": "Belgium", "club": "Tottenham Hotspur", "stats": {"pac": 72, "sho": 64, "pas": 76, "dri": 86, "def": 68, "phy": 83}, "difficulty": "hard"},
    {"playerName": "Antonio Valencia", "cardType": "gold_rare", "fifaEdition": "FIFA 17", "rating": 82, "position": "RB", "nationality": "Ecuador", "club": "Manchester United", "stats": {"pac": 90, "sho": 62, "pas": 68, "dri": 74, "def": 74, "phy": 82}, "difficulty": "hard"},
    # FIFA 18
    {"playerName": "Tiémoué Bakayoko", "cardType": "gold_rare", "fifaEdition": "FIFA 18", "rating": 78, "position": "CDM", "nationality": "France", "club": "Chelsea", "stats": {"pac": 72, "sho": 53, "pas": 66, "dri": 70, "def": 74, "phy": 82}, "difficulty": "medium"},
    {"playerName": "Gabriel Jesus", "cardType": "gold_rare", "fifaEdition": "FIFA 18", "rating": 83, "position": "ST", "nationality": "Brazil", "club": "Manchester City", "stats": {"pac": 90, "sho": 79, "pas": 68, "dri": 86, "def": 36, "phy": 64}, "difficulty": "easy"},
    {"playerName": "Hirving Lozano", "cardType": "gold_rare", "fifaEdition": "FIFA 18", "rating": 79, "position": "RW", "nationality": "Mexico", "club": "PSV", "stats": {"pac": 93, "sho": 72, "pas": 68, "dri": 82, "def": 28, "phy": 60}, "difficulty": "hard"},
    {"playerName": "Romain Alessandrini", "cardType": "gold_rare", "fifaEdition": "FIFA 18", "rating": 80, "position": "RM", "nationality": "France", "club": "LA Galaxy", "stats": {"pac": 86, "sho": 80, "pas": 77, "dri": 85, "def": 33, "phy": 64}, "difficulty": "hard"},
    {"playerName": "Ronaldo", "cardType": "icon", "fifaEdition": "FIFA 18", "rating": 97, "position": "ST", "nationality": "Brazil", "club": "Icons", "stats": {"pac": 95, "sho": 97, "pas": 72, "dri": 96, "def": 37, "phy": 82}, "difficulty": "easy"},
    {"playerName": "Patrick Vieira", "cardType": "icon", "fifaEdition": "FIFA 18", "rating": 91, "position": "CDM", "nationality": "France", "club": "Icons", "stats": {"pac": 75, "sho": 76, "pas": 82, "dri": 78, "def": 86, "phy": 88}, "difficulty": "easy"},
    {"playerName": "Ruud Gullit", "cardType": "icon", "fifaEdition": "FIFA 18", "rating": 93, "position": "CAM", "nationality": "Netherlands", "club": "Icons", "stats": {"pac": 80, "sho": 89, "pas": 85, "dri": 90, "def": 76, "phy": 89}, "difficulty": "easy"},
    {"playerName": "Sandro", "cardType": "gold_rare", "fifaEdition": "FIFA 18", "rating": 83, "position": "LB", "nationality": "Brazil", "club": "Juventus", "stats": {"pac": 87, "sho": 56, "pas": 72, "dri": 75, "def": 81, "phy": 84}, "difficulty": "hard"},
    {"playerName": "Ederson", "cardType": "gold_rare", "fifaEdition": "FIFA 18", "rating": 82, "position": "GK", "nationality": "Brazil", "club": "Manchester City", "stats": {"pac": 55, "sho": 0, "pas": 63, "dri": 15, "def": 16, "phy": 78}, "difficulty": "medium"},
    {"playerName": "Hirving Lozano", "cardType": "tots", "fifaEdition": "FIFA 18", "rating": 94, "position": "RW", "nationality": "Mexico", "club": "PSV", "stats": {"pac": 99, "sho": 90, "pas": 85, "dri": 95, "def": 47, "phy": 72}, "difficulty": "medium"},
    {"playerName": "Marcos Alonso", "cardType": "totw", "fifaEdition": "FIFA 18", "rating": 84, "position": "LB", "nationality": "Spain", "club": "Chelsea", "stats": {"pac": 72, "sho": 76, "pas": 74, "dri": 74, "def": 78, "phy": 82}, "difficulty": "hard"},
    # FIFA 19
    {"playerName": "Wissam Ben Yedder", "cardType": "totw", "fifaEdition": "FIFA 19", "rating": 84, "position": "ST", "nationality": "France", "club": "Sevilla FC", "stats": {"pac": 82, "sho": 85, "pas": 80, "dri": 87, "def": 38, "phy": 60}, "difficulty": "easy"},
    {"playerName": "Fabinho", "cardType": "gold_rare", "fifaEdition": "FIFA 19", "rating": 85, "position": "CDM", "nationality": "Brazil", "club": "Liverpool", "stats": {"pac": 62, "sho": 62, "pas": 71, "dri": 74, "def": 84, "phy": 84}, "difficulty": "easy"},
    {"playerName": "Arjen Robben", "cardType": "eoae", "fifaEdition": "FIFA 19", "rating": 95, "position": "RW", "nationality": "Netherlands", "club": "Bayern Munich", "stats": {"pac": 92, "sho": 93, "pas": 89, "dri": 96, "def": 42, "phy": 68}, "difficulty": "easy"},
    {"playerName": "Virgil van Dijk", "cardType": "gold_rare", "fifaEdition": "FIFA 19", "rating": 85, "position": "CB", "nationality": "Netherlands", "club": "Liverpool", "stats": {"pac": 72, "sho": 59, "pas": 63, "dri": 67, "def": 87, "phy": 86}, "difficulty": "easy"},
    {"playerName": "Paul Pogba", "cardType": "gold_rare", "fifaEdition": "FIFA 19", "rating": 88, "position": "CM", "nationality": "France", "club": "Manchester United", "stats": {"pac": 72, "sho": 80, "pas": 86, "dri": 86, "def": 64, "phy": 83}, "difficulty": "easy"},
    {"playerName": "Neymar Jr", "cardType": "gold_rare", "fifaEdition": "FIFA 19", "rating": 92, "position": "LW", "nationality": "Brazil", "club": "Paris Saint-Germain", "stats": {"pac": 90, "sho": 84, "pas": 87, "dri": 95, "def": 30, "phy": 60}, "difficulty": "easy"},
    {"playerName": "Felipe Anderson", "cardType": "totw", "fifaEdition": "FIFA 19", "rating": 86, "position": "LW", "nationality": "Brazil", "club": "West Ham United", "stats": {"pac": 92, "sho": 80, "pas": 78, "dri": 89, "def": 40, "phy": 60}, "difficulty": "hard"},
    {"playerName": "Douglas Costa", "cardType": "gold_rare", "fifaEdition": "FIFA 19", "rating": 85, "position": "LW", "nationality": "Brazil", "club": "Juventus", "stats": {"pac": 95, "sho": 72, "pas": 80, "dri": 91, "def": 26, "phy": 57}, "difficulty": "hard"},
    {"playerName": "Davinson Sánchez", "cardType": "gold_rare", "fifaEdition": "FIFA 19", "rating": 84, "position": "CB", "nationality": "Colombia", "club": "Tottenham Hotspur", "stats": {"pac": 80, "sho": 35, "pas": 50, "dri": 57, "def": 84, "phy": 86}, "difficulty": "hard"},
    {"playerName": "Alexandre Lacazette", "cardType": "gold_rare", "fifaEdition": "FIFA 19", "rating": 85, "position": "ST", "nationality": "France", "club": "Arsenal", "stats": {"pac": 79, "sho": 83, "pas": 74, "dri": 85, "def": 37, "phy": 70}, "difficulty": "medium"},
    # FIFA 20
    {"playerName": "Wissam Ben Yedder", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 83, "position": "ST", "nationality": "France", "club": "AS Monaco", "stats": {"pac": 81, "sho": 83, "pas": 78, "dri": 86, "def": 36, "phy": 61}, "difficulty": "easy"},
    {"playerName": "Moussa Sissoko", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 80, "position": "CDM", "nationality": "France", "club": "Tottenham Hotspur", "stats": {"pac": 79, "sho": 55, "pas": 67, "dri": 72, "def": 72, "phy": 85}, "difficulty": "medium"},
    {"playerName": "Ryan Kent", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 73, "position": "LM", "nationality": "England", "club": "Rangers", "stats": {"pac": 90, "sho": 62, "pas": 62, "dri": 79, "def": 30, "phy": 58}, "difficulty": "medium"},
    {"playerName": "Ousmane Dembélé", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 83, "position": "RW", "nationality": "France", "club": "FC Barcelona", "stats": {"pac": 93, "sho": 74, "pas": 80, "dri": 88, "def": 29, "phy": 49}, "difficulty": "easy"},
    {"playerName": "Adama Traoré", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 77, "position": "RM", "nationality": "Spain", "club": "Wolverhampton", "stats": {"pac": 96, "sho": 53, "pas": 55, "dri": 84, "def": 29, "phy": 79}, "difficulty": "medium"},
    {"playerName": "Youcef Atal", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 77, "position": "RB", "nationality": "Algeria", "club": "OGC Nice", "stats": {"pac": 93, "sho": 68, "pas": 72, "dri": 83, "def": 64, "phy": 67}, "difficulty": "hard"},
    {"playerName": "Neymar Jr", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 92, "position": "LW", "nationality": "Brazil", "club": "Paris Saint-Germain", "stats": {"pac": 91, "sho": 85, "pas": 86, "dri": 94, "def": 36, "phy": 59}, "difficulty": "easy"},
    {"playerName": "Lucas Hernández", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 83, "position": "CB", "nationality": "France", "club": "Bayern Munich", "stats": {"pac": 80, "sho": 38, "pas": 60, "dri": 63, "def": 82, "phy": 84}, "difficulty": "hard"},
    {"playerName": "Kylian Mbappé", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 89, "position": "ST", "nationality": "France", "club": "Paris Saint-Germain", "stats": {"pac": 96, "sho": 86, "pas": 78, "dri": 91, "def": 39, "phy": 73}, "difficulty": "easy"},
    {"playerName": "Nélson Semedo", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 82, "position": "RB", "nationality": "Portugal", "club": "FC Barcelona", "stats": {"pac": 92, "sho": 52, "pas": 73, "dri": 81, "def": 76, "phy": 72}, "difficulty": "hard"},
    {"playerName": "Lenglet", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 83, "position": "CB", "nationality": "France", "club": "FC Barcelona", "stats": {"pac": 66, "sho": 35, "pas": 63, "dri": 67, "def": 84, "phy": 77}, "difficulty": "hard"},
    {"playerName": "Allan", "cardType": "gold_rare", "fifaEdition": "FIFA 20", "rating": 84, "position": "CDM", "nationality": "Brazil", "club": "Napoli", "stats": {"pac": 72, "sho": 60, "pas": 76, "dri": 82, "def": 82, "phy": 80}, "difficulty": "hard"},
]


def normalize_name(name: str) -> str:
    return unicodedata.normalize("NFD", name).encode("ascii", "ignore").decode("utf-8").lower().strip()


def generate_accepted_answers(player_name: str) -> list:
    answers = set()
    answers.add(player_name)
    parts = player_name.strip().split()
    if len(parts) > 1:
        answers.add(parts[-1])
    normalized = unicodedata.normalize("NFD", player_name).encode("ascii", "ignore").decode("utf-8")
    if normalized != player_name:
        answers.add(normalized)
        norm_parts = normalized.strip().split()
        if len(norm_parts) > 1:
            answers.add(norm_parts[-1])
    # Special cases
    if "Neymar" in player_name:
        answers.update(["Neymar", "Neymar Jr"])
    if "Ronaldo" == player_name:
        answers.update(["R9", "Ronaldo", "Ronaldo Nazário", "Ronaldo Nazario"])
    if "Mbappé" in player_name:
        answers.update(["Mbappe", "Mbappé"])
    if "Kanté" in player_name:
        answers.update(["Kante", "Kanté", "Ngolo Kante"])
    if "Son" in player_name and "Heung" in player_name:
        answers.update(["Son", "Son Heung-min", "Son Heung Min"])
    if "Dembélé" in player_name:
        answers.update(["Dembele", "Dembélé"])
    if "Ronaldinho" in player_name:
        answers.add("Ronaldinho")
    return list(answers)


def parse_stat(val: str) -> int:
    try:
        return int(val.strip())
    except (ValueError, AttributeError):
        return 50


def load_csv_players(filepath: str) -> list:
    """Load all players from a CSV file into a list of dicts."""
    players = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = reader.fieldnames or []
        col_name = "Name"
        col_rating = "RAT" if "RAT" in headers else "Ratings"
        col_position = "POS" if "POS" in headers else "Position"
        col_version = "VER" if "VER" in headers else "Version"

        for row in reader:
            name = row.get(col_name, "").strip()
            if not name:
                continue
            rating = parse_stat(row.get(col_rating, "0"))
            position = row.get(col_position, "ST").strip().split(",")[0].strip().split()[0]
            version = row.get(col_version, "Gold Rare").strip()
            # Split version on double space to get card type
            ver_parts = version.split("  ")
            ver_label = ver_parts[0].strip()

            players.append({
                "name": name,
                "rating": rating,
                "position": position,
                "version": ver_label,
                "pac": parse_stat(row.get("PAC", "50")),
                "sho": parse_stat(row.get("SHO", "50")),
                "pas": parse_stat(row.get("PAS", "50")),
                "dri": parse_stat(row.get("DRI", "50")),
                "def": parse_stat(row.get("DEF", "50")),
                "phy": parse_stat(row.get("PHY", "50")),
                "club": row.get("Club", ""),
                "country": row.get("Country", ""),
            })
    return players


def find_player_in_csv(csv_players: list, target_name: str, preferred_version: str | None) -> dict | None:
    """Find a player in CSV data by exact full name match only."""
    norm_target = normalize_name(target_name)
    matches = []
    for p in csv_players:
        norm_p = normalize_name(p["name"])
        if norm_p == norm_target:
            matches.append(p)

    if not matches:
        return None

    if preferred_version and preferred_version.lower() == "gold rare":
        # For base gold rare cards: look for "Rare", empty version, or "Gold"
        # These are the base cards people actually played with
        base_matches = [m for m in matches if m["version"].lower() in ("rare", "", "gold", "gold rare")]
        if base_matches:
            # Pick lowest rated = the actual base card
            base_matches.sort(key=lambda x: x["rating"])
            return base_matches[0]
        # Fallback: just pick the lowest rated version overall
        matches.sort(key=lambda x: x["rating"])
        return matches[0]

    if preferred_version:
        pv = preferred_version.lower()
        ver_matches = [m for m in matches if pv in m["version"].lower()]
        if ver_matches:
            ver_matches.sort(key=lambda x: x["rating"], reverse=True)
            return ver_matches[0]

    # No version preference: return highest rated
    matches.sort(key=lambda x: x["rating"], reverse=True)
    return matches[0]


def get_difficulty(rating: int, card_type: str) -> str:
    if rating >= 90:
        return "easy"
    if rating >= 85 or card_type in ("toty", "tots", "icon"):
        return "medium"
    return "hard"


def map_card_type(version_str: str) -> str:
    v = version_str.lower()
    if "toty" in v: return "toty"
    if "tots" in v: return "tots"
    if "totw" in v or "inform" in v: return "totw"
    if "icon" in v or "prime" in v: return "icon"
    if "hero" in v: return "hero"
    if "headliner" in v: return "headliners"
    if "future star" in v: return "future_stars"
    if "sbc" in v: return "sbc"
    if "flashback" in v: return "flashback"
    if "eoae" in v or "end of an era" in v: return "eoae"
    if "potm" in v: return "potm"
    if "birthday" in v: return "fut_birthday"
    if "futties" in v: return "futties"
    if "rulebreaker" in v: return "rulebreakers"
    if "objective" in v or "obj" in v: return "objetivos"
    if "otw" in v: return "otw"
    if "shapeshifter" in v: return "sbc"
    if "level up" in v: return "objetivos"
    if "fof" in v: return "sbc"
    if "moment" in v: return "icon"
    return "gold_rare"


def main():
    all_cards = []
    global_id = 0

    # 1. Add hardcoded cards (FIFA 17, 18, 19, 20)
    print("Adding hardcoded META cards (FIFA 17-20)...")
    for hc in HARDCODED_CARDS:
        global_id += 1
        card = {
            "id": f"fut-{str(global_id).zfill(3)}",
            "type": "futcard",
            "playerName": hc["playerName"],
            "acceptedAnswers": generate_accepted_answers(hc["playerName"]),
            "cardType": hc["cardType"],
            "fifaEdition": hc["fifaEdition"],
            "rating": hc["rating"],
            "position": hc["position"],
            "nationality": hc["nationality"],
            "club": hc["club"],
            "stats": hc["stats"],
            "difficulty": hc["difficulty"],
            "timeLimit": 20,
            "points": 100,
        }
        all_cards.append(card)

    # 2. Process Kaggle datasets (FIFA 21, 23, FC 24)
    for edition, filepath in DATASETS.items():
        if not os.path.exists(filepath):
            print(f"  Skipping {edition}: file not found")
            continue

        print(f"\nProcessing {edition}...")
        csv_players = load_csv_players(filepath)
        print(f"  Loaded {len(csv_players)} players from CSV")

        meta_list = META_CARDS.get(edition, [])
        found = 0
        not_found = []

        for target_name, preferred_ver, club_override, country_override in meta_list:
            match = find_player_in_csv(csv_players, target_name, preferred_ver)

            global_id += 1
            if match:
                found += 1
                card_type = map_card_type(match["version"]) if not preferred_ver else map_card_type(preferred_ver)
                card = {
                    "id": f"fut-{str(global_id).zfill(3)}",
                    "type": "futcard",
                    "playerName": match["name"],
                    "acceptedAnswers": generate_accepted_answers(match["name"]),
                    "cardType": card_type,
                    "fifaEdition": edition,
                    "rating": match["rating"],
                    "position": match["position"],
                    "nationality": country_override or match.get("country", "Unknown"),
                    "club": club_override or match.get("club", "Unknown"),
                    "stats": {
                        "pac": match["pac"],
                        "sho": match["sho"],
                        "pas": match["pas"],
                        "dri": match["dri"],
                        "def": match["def"],
                        "phy": match["phy"],
                    },
                    "difficulty": get_difficulty(match["rating"], card_type),
                    "timeLimit": 20,
                    "points": 100,
                }
            else:
                not_found.append(target_name)
                # Use overrides with estimated stats
                card = {
                    "id": f"fut-{str(global_id).zfill(3)}",
                    "type": "futcard",
                    "playerName": target_name,
                    "acceptedAnswers": generate_accepted_answers(target_name),
                    "cardType": map_card_type(preferred_ver or "Gold Rare"),
                    "fifaEdition": edition,
                    "rating": 85,
                    "position": "ST",
                    "nationality": country_override or "Unknown",
                    "club": club_override or "Unknown",
                    "stats": {"pac": 80, "sho": 80, "pas": 75, "dri": 80, "def": 50, "phy": 70},
                    "difficulty": "medium",
                    "timeLimit": 20,
                    "points": 100,
                }
            all_cards.append(card)

        print(f"  Found {found}/{len(meta_list)} players in CSV")
        if not_found:
            print(f"  Not found: {', '.join(not_found)}")

    # Summary
    print(f"\n{'='*50}")
    print(f"Total cards: {len(all_cards)}")
    editions = sorted(set(c["fifaEdition"] for c in all_cards))
    for ed in editions:
        count = sum(1 for c in all_cards if c["fifaEdition"] == ed)
        print(f"  {ed}: {count} cards")

    # Print all cards
    for ed in editions:
        ed_cards = [c for c in all_cards if c["fifaEdition"] == ed]
        print(f"\n  {ed}:")
        for c in ed_cards:
            print(f"    {c['rating']} {c['position']:4s} {c['playerName']:25s} ({c['cardType']}) - {c['club']}")

    # Write output
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_cards, f, indent=2, ensure_ascii=False)
    print(f"\nWritten to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
