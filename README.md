# Pokémon Battle Predictor

A data project that aims to predict the outcome of a battle between two Pokémon, using their base stats and type match-ups. This repo currently holds the **data collection and preparation stage** of the project — the datasets that any future prediction model will be built on.

## Project status

🚧 Early stage. So far the project fetches and cleans raw Pokémon data from [PokeAPI](https://pokeapi.co/) and builds a type-effectiveness chart. No battle simulation logic or prediction model has been built yet — see the [Roadmap](#roadmap) below.

## Repository structure

```
pokemon-battle-predictor/
├── pokemon_data.ipynb   # Notebook: fetches, processes and exports the datasets
├── pokemon.csv          # Base stats + typing for 834 Pokémon
├── pokemon_data.csv     # Raw name/URL list of all 1024 Pokémon (fetch queue)
├── type_chart.csv       # 18x18 type-effectiveness multiplier matrix
├── .gitignore
└── README.md
```

## Data

### `pokemon.csv`
One row per Pokémon (834 rows, ids 1–834; 425 mono-type and 409 dual-type), sourced from PokeAPI:

| Column | Description |
|---|---|
| `id` | Pokédex ID |
| `name` | Pokémon name |
| `hp` | Base HP stat |
| `attack` | Base Attack stat |
| `defense` | Base Defense stat |
| `special_attack` | Base Special Attack stat |
| `special_defense` | Base Special Defense stat |
| `speed` | Base Speed stat |
| `type1` | Primary type |
| `type2` | Secondary type (`null` if the Pokémon has only one type) |

### `type_chart.csv`
An 18×18 matrix of type-effectiveness multipliers, rows = attacking type, columns = defending type (e.g. `type_chart.loc["Water", "Fire"] == 2.0`). Values follow the standard 0 / 0.5 / 1 / 2 damage-multiplier scale.

### `pokemon_data.csv`
Intermediate file: a flat list of all 1024 Pokémon names and their PokeAPI detail URLs, used as the fetch queue before per-Pokémon stats are pulled and flattened into `pokemon.csv`.

## Notebook walkthrough (`pokemon_data.ipynb`)

1. **Fetch the Pokémon list** — calls PokeAPI's `/pokemon?offset=0&limit=1024` endpoint to get every Pokémon's name and detail URL.
2. **Fetch per-Pokémon details** — loops over each URL and pulls base stats and types.
3. **Flatten to a table** — reshapes the nested stats/types response into flat columns (`hp`, `attack`, … `type1`, `type2`).
4. **Export `pokemon.csv`** — saves the flattened data with pandas.
5. **Build the type chart** — creates an 18×18 DataFrame indexed by type name and exports it to `type_chart.csv`.
6. **Sanity check** — reloads `type_chart.csv` and looks up a sample match-up (`Water` vs `Fire`) to confirm it loads correctly.

## Tech stack

- Python 3.12
- [`requests`](https://pypi.org/project/requests/) — PokeAPI calls
- [`pandas`](https://pypi.org/project/pandas/) — data wrangling and CSV export
- [`numpy`](https://pypi.org/project/numpy/) — type chart matrix generation
- [PokeAPI](https://pokeapi.co/) — data source

## Getting started

```bash
git clone https://github.com/Vivekraj-adhikari/pokemon-battle-predictor.git
cd pokemon-battle-predictor

python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

pip install requests pandas numpy jupyter
jupyter notebook pokemon_data.ipynb
```

`pokemon.csv` and `type_chart.csv` are already generated and committed, so you don't need to re-run the notebook just to explore the data:

```python
import pandas as pd

pokemon = pd.read_csv("pokemon.csv")
type_chart = pd.read_csv("type_chart.csv", index_col=0)
```

## Roadmap

- [x] Pull raw Pokémon stats and typing from PokeAPI
- [x] Build a type-effectiveness chart
- [ ] Feature engineering (stat totals, type-advantage scores, etc.)
- [ ] Battle simulation / labeling logic to generate training data
- [ ] Train a model to predict battle outcomes
- [ ] Evaluate and expose predictions (script, notebook, or simple API)

## License

No license has been added to this repository yet.

## Acknowledgements

<<<<<<< HEAD
Data provided by [PokeAPI](https://pokeapi.co/).
=======
Data provided by [PokeAPI](https://pokeapi.co/).
>>>>>>> 3b7a6e6 (Creates readme for project)
