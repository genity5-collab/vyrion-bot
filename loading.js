export const STATUS_LINES = [
    "Booting up Vyrion core...",
    "Warming up the moderation hammer 🔨",
    "Downloading more RAM... 💾",
    "Consulting the vibe crystal 🔮",
    "Sharpening the ban hammer... 🔨",
    "Feeding the Vyrion dragon 🐉",
    "Untangling the cables 🧶",
    "Polishing the pixels... ✨",
    "Counting to infinity (twice)... 🔢",
    "Greasing the command gears ⚙️",
    "Bribing the Discord servers... 🤝",
    "Reticulating splines... 📐",
];

const FRAMES = 6;
const DELAY = 170; // total animation ~1s

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function loadingBar(interaction, status = "⏳ Vyrion is working") {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply();
    let last = null;
    for (let i = 1; i <= FRAMES; i++) {
        let line = STATUS_LINES[Math.floor(Math.random() * STATUS_LINES.length)];
        while (line === last) line = STATUS_LINES[Math.floor(Math.random() * STATUS_LINES.length)];
        last = line;
        const bar = "▰".repeat(i) + "▱".repeat(FRAMES - i);
        try {
            await interaction.editReply({ content: `${status}\n\`${bar}\` ${line}` });
        } catch {
            return;
        }
        await sleep(DELAY);
    }
}
