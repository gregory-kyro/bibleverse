"""
Domain configuration for the Bible Mapped project.
Book metadata, genre taxonomy, entity dictionaries, and shared constants.
"""

BOOKS = [
    {"name": "Genesis", "abbrev": "Gen", "num": 1, "testament": "OT", "genre": "Law"},
    {"name": "Exodus", "abbrev": "Exod", "num": 2, "testament": "OT", "genre": "Law"},
    {"name": "Leviticus", "abbrev": "Lev", "num": 3, "testament": "OT", "genre": "Law"},
    {"name": "Numbers", "abbrev": "Num", "num": 4, "testament": "OT", "genre": "Law"},
    {"name": "Deuteronomy", "abbrev": "Deut", "num": 5, "testament": "OT", "genre": "Law"},
    {"name": "Joshua", "abbrev": "Josh", "num": 6, "testament": "OT", "genre": "History"},
    {"name": "Judges", "abbrev": "Judg", "num": 7, "testament": "OT", "genre": "History"},
    {"name": "Ruth", "abbrev": "Ruth", "num": 8, "testament": "OT", "genre": "History"},
    {"name": "1 Samuel", "abbrev": "1Sam", "num": 9, "testament": "OT", "genre": "History"},
    {"name": "2 Samuel", "abbrev": "2Sam", "num": 10, "testament": "OT", "genre": "History"},
    {"name": "1 Kings", "abbrev": "1Kgs", "num": 11, "testament": "OT", "genre": "History"},
    {"name": "2 Kings", "abbrev": "2Kgs", "num": 12, "testament": "OT", "genre": "History"},
    {"name": "1 Chronicles", "abbrev": "1Chr", "num": 13, "testament": "OT", "genre": "History"},
    {"name": "2 Chronicles", "abbrev": "2Chr", "num": 14, "testament": "OT", "genre": "History"},
    {"name": "Ezra", "abbrev": "Ezra", "num": 15, "testament": "OT", "genre": "History"},
    {"name": "Nehemiah", "abbrev": "Neh", "num": 16, "testament": "OT", "genre": "History"},
    {"name": "Esther", "abbrev": "Esth", "num": 17, "testament": "OT", "genre": "History"},
    {"name": "Job", "abbrev": "Job", "num": 18, "testament": "OT", "genre": "Wisdom"},
    {"name": "Psalms", "abbrev": "Ps", "num": 19, "testament": "OT", "genre": "Wisdom"},
    {"name": "Proverbs", "abbrev": "Prov", "num": 20, "testament": "OT", "genre": "Wisdom"},
    {"name": "Ecclesiastes", "abbrev": "Eccl", "num": 21, "testament": "OT", "genre": "Wisdom"},
    {"name": "Song of Solomon", "abbrev": "Song", "num": 22, "testament": "OT", "genre": "Wisdom"},
    {"name": "Isaiah", "abbrev": "Isa", "num": 23, "testament": "OT", "genre": "Major Prophets"},
    {"name": "Jeremiah", "abbrev": "Jer", "num": 24, "testament": "OT", "genre": "Major Prophets"},
    {"name": "Lamentations", "abbrev": "Lam", "num": 25, "testament": "OT", "genre": "Major Prophets"},
    {"name": "Ezekiel", "abbrev": "Ezek", "num": 26, "testament": "OT", "genre": "Major Prophets"},
    {"name": "Daniel", "abbrev": "Dan", "num": 27, "testament": "OT", "genre": "Major Prophets"},
    {"name": "Hosea", "abbrev": "Hos", "num": 28, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Joel", "abbrev": "Joel", "num": 29, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Amos", "abbrev": "Amos", "num": 30, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Obadiah", "abbrev": "Obad", "num": 31, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Jonah", "abbrev": "Jonah", "num": 32, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Micah", "abbrev": "Mic", "num": 33, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Nahum", "abbrev": "Nah", "num": 34, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Habakkuk", "abbrev": "Hab", "num": 35, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Zephaniah", "abbrev": "Zeph", "num": 36, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Haggai", "abbrev": "Hag", "num": 37, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Zechariah", "abbrev": "Zech", "num": 38, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Malachi", "abbrev": "Mal", "num": 39, "testament": "OT", "genre": "Minor Prophets"},
    {"name": "Matthew", "abbrev": "Matt", "num": 40, "testament": "NT", "genre": "Gospels"},
    {"name": "Mark", "abbrev": "Mark", "num": 41, "testament": "NT", "genre": "Gospels"},
    {"name": "Luke", "abbrev": "Luke", "num": 42, "testament": "NT", "genre": "Gospels"},
    {"name": "John", "abbrev": "John", "num": 43, "testament": "NT", "genre": "Gospels"},
    {"name": "Acts", "abbrev": "Acts", "num": 44, "testament": "NT", "genre": "Acts"},
    {"name": "Romans", "abbrev": "Rom", "num": 45, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "1 Corinthians", "abbrev": "1Cor", "num": 46, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "2 Corinthians", "abbrev": "2Cor", "num": 47, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "Galatians", "abbrev": "Gal", "num": 48, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "Ephesians", "abbrev": "Eph", "num": 49, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "Philippians", "abbrev": "Phil", "num": 50, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "Colossians", "abbrev": "Col", "num": 51, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "1 Thessalonians", "abbrev": "1Thess", "num": 52, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "2 Thessalonians", "abbrev": "2Thess", "num": 53, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "1 Timothy", "abbrev": "1Tim", "num": 54, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "2 Timothy", "abbrev": "2Tim", "num": 55, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "Titus", "abbrev": "Titus", "num": 56, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "Philemon", "abbrev": "Phlm", "num": 57, "testament": "NT", "genre": "Pauline Epistles"},
    {"name": "Hebrews", "abbrev": "Heb", "num": 58, "testament": "NT", "genre": "General Epistles"},
    {"name": "James", "abbrev": "Jas", "num": 59, "testament": "NT", "genre": "General Epistles"},
    {"name": "1 Peter", "abbrev": "1Pet", "num": 60, "testament": "NT", "genre": "General Epistles"},
    {"name": "2 Peter", "abbrev": "2Pet", "num": 61, "testament": "NT", "genre": "General Epistles"},
    {"name": "1 John", "abbrev": "1John", "num": 62, "testament": "NT", "genre": "General Epistles"},
    {"name": "2 John", "abbrev": "2John", "num": 63, "testament": "NT", "genre": "General Epistles"},
    {"name": "3 John", "abbrev": "3John", "num": 64, "testament": "NT", "genre": "General Epistles"},
    {"name": "Jude", "abbrev": "Jude", "num": 65, "testament": "NT", "genre": "General Epistles"},
    {"name": "Revelation", "abbrev": "Rev", "num": 66, "testament": "NT", "genre": "Apocalyptic"},
]

BOOK_NAME_TO_META = {b["name"]: b for b in BOOKS}
BOOK_NUM_TO_META = {b["num"]: b for b in BOOKS}

GENRE_COLORS = {
    "Law":               "#e6c865",
    "History":           "#7cb5a0",
    "Wisdom":            "#c490d1",
    "Major Prophets":    "#e07a5f",
    "Minor Prophets":    "#f2a65a",
    "Gospels":           "#5b9bd5",
    "Acts":              "#45a0a0",
    "Pauline Epistles":  "#8bc34a",
    "General Epistles":  "#4dd0e1",
    "Apocalyptic":       "#ef5350",
}

GENRE_ORDER = list(GENRE_COLORS.keys())

# Curated entity dictionaries for reliable extraction on archaic KJV text.
# spaCy NER was trained on modern English and misses most biblical names.

PEOPLE = [
    "God", "LORD", "Jesus", "Christ", "Moses", "Abraham", "Abram", "David",
    "Solomon", "Jacob", "Isaac", "Joseph", "Adam", "Eve", "Noah", "Elijah",
    "Elisha", "Isaiah", "Jeremiah", "Ezekiel", "Daniel", "Samuel", "Saul",
    "Joshua", "Aaron", "Pharaoh", "Peter", "Simon", "Paul", "John",
    "Mary", "Martha", "Lazarus", "Ruth", "Esther", "Mordecai", "Haman",
    "Nehemiah", "Ezra", "Job", "Jonah", "Samson", "Gideon", "Deborah",
    "Rahab", "Boaz", "Naomi", "Eli", "Nathan", "Absalom", "Rehoboam",
    "Jeroboam", "Ahab", "Jezebel", "Hezekiah", "Josiah", "Cyrus",
    "Nebuchadnezzar", "Pilate", "Herod", "Judas", "Thomas", "Matthew",
    "Mark", "Luke", "Timothy", "Titus", "Barnabas", "Stephen", "Philip",
    "Andrew", "James", "Nicodemus", "Cain", "Abel", "Seth", "Enoch",
    "Melchizedek", "Lot", "Laban", "Rachel", "Leah", "Reuben", "Simeon",
    "Levi", "Benjamin", "Caleb", "Balaam", "Balak", "Barak",
    "Jephthah", "Hannah", "Goliath", "Jonathan", "Bathsheba", "Uriah",
    "Elkanah", "Abigail", "Michal", "Joab", "Amnon", "Tamar",
    "Athaliah", "Asa", "Jehoshaphat", "Manasseh", "Zerubbabel",
    "Haggai", "Zechariah", "Malachi", "Anna", "Simeon",
    "Zacchaeus", "Cornelius", "Lydia", "Priscilla", "Aquila",
    "Apollos", "Silas", "Epaphras", "Onesimus", "Philemon",
]

PLACES = [
    "Jerusalem", "Bethlehem", "Egypt", "Babylon", "Rome", "Nazareth",
    "Galilee", "Samaria", "Judah", "Israel", "Jordan", "Sinai", "Zion",
    "Eden", "Canaan", "Assyria", "Persia", "Damascus", "Antioch",
    "Corinth", "Ephesus", "Philippi", "Thessalonica", "Galatia",
    "Colossae", "Crete", "Cyprus", "Tyre", "Sidon", "Jericho",
    "Bethany", "Capernaum", "Gethsemane", "Golgotha", "Calvary",
    "Hebron", "Beersheba", "Shechem", "Shiloh", "Gilgal", "Bethel",
    "Ai", "Nineveh", "Ur", "Haran", "Sodom", "Gomorrah",
    "Red Sea", "Sea of Galilee", "Dead Sea", "Mount Sinai",
    "Mount Zion", "Mount Carmel", "Mount Hermon", "Mount Olivet",
    "Ararat", "Moriah", "Patmos", "Pergamos", "Smyrna", "Sardis",
    "Philadelphia", "Laodicea", "Tarshish", "Ophir", "Moab",
    "Edom", "Ammon", "Philistia", "Lebanon", "Tarsus",
]

GROUPS = [
    "Pharisees", "Sadducees", "Levites", "Israelites", "Gentiles",
    "Apostles", "Disciples", "Scribes", "Priests", "Elders",
    "Prophets", "Philistines", "Egyptians", "Babylonians", "Assyrians",
    "Canaanites", "Amorites", "Hittites", "Moabites", "Edomites",
    "Samaritans", "Romans", "Greeks", "Jews", "Hebrews",
    "Midianites", "Amalekites", "Perizzites", "Hivites", "Jebusites",
]

# Merge entity alias handling: some names refer to the same entity
ENTITY_ALIASES = {
    "Abram": "Abraham",
    "Simon": "Peter",
    "Christ": "Jesus",
    "LORD": "God",
}

# UMAP parameters
UMAP_N_NEIGHBORS = 15
UMAP_MIN_DIST = 0.1
UMAP_METRIC = "cosine"
UMAP_RANDOM_STATE = 42

EMBEDDING_MODEL = "odunola/sentence-transformers-bible-reference-final"
TOP_K_NEIGHBORS = 8

# Data source: public-domain KJV from GitHub
KJV_SOURCE_BASE = "https://raw.githubusercontent.com/aruljohn/Bible-kjv/master"

# File names used by the pipeline to read/write intermediate and final data
RAW_DATA_FILE = "kjv_raw.json"
VERSES_FILE = "verses.json"
EMBEDDINGS_FILE = "embeddings.npy"
UMAP_FILE = "umap_coords.json"
NEIGHBORS_FILE = "neighbors.json"
GRAPH_FILE = "graph.json"
METRICS_FILE = "metrics.json"
HEATMAP_FILE = "heatmap.json"
HAPAX_FILE = "hapax.json"
