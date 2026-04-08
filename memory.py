from mem0 import Memory

memory = Memory.from_config({
    "llm": {
        "provider": "ollama",
        "config": {
            "model": "llama3"
        }
    },
    "embedder": {
        "provider": "ollama",
        "config": {
            "model": "nomic-embed-text"
        }
    }
})

memory.add(
    "User is building Audio Hub app using React Native",
    user_id="audio_user_1"
)

results = memory.search(
    "What is user building?",
    user_id="audio_user_1"
)

print(results)