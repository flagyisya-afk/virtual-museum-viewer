# minecraft_name_checker.py
# Usage: python minecraft_name_checker.py
# Requires: pip install requests
'''
import requests
import time

# Put your 60 names here (exactly as you want to check them)
usernames = [
    "Sourdough","Ciabatta","Baguette","RyeBread","Brioche","Focaccia",
    "Pumpernickel","Cornbread","Challah","Flatbread","Multigrain",
    "Wholewheat","Bagel","Pretzel","Scone","BunLoaf","DinnerRoll",
    "MilkBread","PaneRustico","PainAuLevain","Batard","KaiserRoll",
    "HeroRoll","CrustyLoaf","Croissant","Panettone","Stollen","Lavash",
    "Matzo","Naan","Paratha","Roti","Tortilla","Arepa","Barmbrack",
    "Anadama","SodaBread","Graham","PainDeCampagne","Boule","Breadstick",
    "SeededRye","Marraqueta","TigerBread","Bolillo","Simit","Fougasse",
    "Lefse","Vollkorn","Einkorn","SpeltLoaf","OatBread","Mollete",
    "Bublik","Beigli","Crumpet","EnglishMuffin","BrownBread","SaltedBun",
    "RyeLoaf"
]

API_URL = "https://api.mojang.com/users/profiles/minecraft/{}"
HEADERS = {"User-Agent": "MinecraftNameChecker/1.0 (+https://example.com)"}

def check_name(name, max_retries=3):
    url = API_URL.format(name)
    retry = 0
    while retry < max_retries:
        try:
            resp = requests.get(url, headers=HEADERS, timeout=8)
        except requests.RequestException as e:
            retry += 1
            time.sleep(1 * retry)
            continue

        # Mojang behavior (common patterns):
        #  - 200 OK -> name is taken (returns JSON with id/name)
        #  - 204 No Content -> name not found (available)
        #  - 404 sometimes used by other services -> treat as available
        #  - 429 -> rate limit, retry after brief pause
        if resp.status_code == 200:
            return "TAKEN", resp.json()  # includes id + name
        elif resp.status_code == 204 or resp.status_code == 404:
            return "AVAILABLE", None
        elif resp.status_code == 429:
            # rate limited; wait and retry
            wait = 2 + retry * 2
            time.sleep(wait)
            retry += 1
            continue
        else:
            # unexpected status: return error with code and body for debugging
            return f"ERROR {resp.status_code}", resp.text

    return "ERROR (max retries)", None

def main():
    results = {}
    for i, name in enumerate(usernames, start=1):
        status, info = check_name(name)
        results[name] = (status, info)
        # Print immediately so you see progress
        if status == "TAKEN":
            print(f"{i:02d}. {name:16} — TAKEN (uuid: {info.get('id')})")
        elif status == "AVAILABLE":
            print(f"{i:02d}. {name:16} — AVAILABLE")
        else:
            print(f"{i:02d}. {name:16} — {status}")

        # Be polite with Mojang API; small sleep avoids hitting limits.
        # If you have many names, increase this.
        time.sleep(0.35)

    # Optionally, save results to file
    with open("name_check_results.txt", "w", encoding="utf-8") as f:
        for name, (status, info) in results.items():
            if status == "TAKEN":
                f.write(f"{name}: TAKEN, uuid={info.get('id')}\n")
            else:
                f.write(f"{name}: {status}\n")

    print("\nDone. Results written to name_check_results.txt")

if __name__ == "__main__":
    main()
 '''


#-----------------------------------------------------------------------------------------------
'''
# bread_name_checker.py
# Usage: python bread_name_checker.py
# Requires: pip install requests

import requests
import time

API_URL = "https://api.mojang.com/users/profiles/minecraft/{}"
HEADERS = {"User-Agent": "BreadNameChecker/1.0"}

# Base bread names
breads = [
    "Sourdough","Ciabatta","Baguette","RyeBread","Brioche","Focaccia",
    "Pumpernickel","Cornbread","Challah","Flatbread","Multigrain",
    "Wholewheat","Bagel","Pretzel","Scone","BunLoaf","DinnerRoll",
    "MilkBread","PaneRustico","PainAuLevain","Batard","KaiserRoll",
    "HeroRoll","CrustyLoaf","Croissant","Panettone","Stollen","Lavash",
    "Matzo","Naan","Paratha","Roti","Tortilla","Arepa","Barmbrack",
    "Anadama","SodaBread","Graham","PainDeCampagne","Boule","Breadstick",
    "SeededRye","Marraqueta","TigerBread","Bolillo","Simit","Fougasse",
    "Lefse","Vollkorn","Einkorn","SpeltLoaf","OatBread","Mollete",
    "Bublik","Beigli","Crumpet","EnglishMuffin","BrownBread","SaltedBun",
    "RyeLoaf"
]

# Adjectives to prepend if taken
adjectives = [
    "Golden","Toasted","Crispy","Fresh","Rustic","Warm","Buttery",
    "Sweet","Savory","Soft","Fluffy","Spicy","Glazed","Crunchy"
]

def check_name(name, max_retries=3):
    """Check Mojang API for name availability."""
    url = API_URL.format(name)
    for attempt in range(max_retries):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=8)
        except requests.RequestException:
            time.sleep(.1 * (attempt+1))
            continue

        if resp.status_code == 200:
            return "TAKEN", resp.json()
        elif resp.status_code in (204, 404):
            return "AVAILABLE", None
        elif resp.status_code == 429:
            time.sleep(2 + attempt * 2)
            continue
        else:
            return f"ERROR {resp.status_code}", resp.text
    return "ERROR (max retries)", None

def main():
    results = []
    for bread in breads:
        status, info = check_name(bread)
        if status == "AVAILABLE":
            results.append(f"{bread}: AVAILABLE")
            print(f"{bread:16} — AVAILABLE")
        elif status == "TAKEN":
            results.append(f"{bread}: TAKEN")
            print(f"{bread:16} — TAKEN, checking variants...")
            # Try adjectives
            for adj in adjectives:
                variant = adj + bread
                if len(variant) > 16:  # skip too long names
                    continue
                vstatus, _ = check_name(variant)
                results.append(f"  {variant}: {vstatus}")
                print(f"   {variant:16} — {vstatus}")
                time.sleep(0.35)
        else:
            results.append(f"{bread}: {status}")
            print(f"{bread:16} — {status}")
        time.sleep(0.1)

    # Save results
    with open("bread_name_results.txt", "w", encoding="utf-8") as f:
        f.write("\n".join(results))
    print("\nDone. Results saved to bread_name_results.txt")

if __name__ == "__main__":
    main()
'''
# minecraft_name_checker_gui_v3.py
# Requires: pip install requests pillow
import tkinter as tk
from tkinter import scrolledtext, messagebox, filedialog
import requests
import webbrowser
from PIL import Image, ImageTk
from io import BytesIO
import time

API_URL = "https://api.mojang.com/users/profiles/minecraft/{}"
HEADERS = {"User-Agent": "MinecraftNameChecker/1.0"}
CRAFTATAR_HEAD_URL = "https://crafatar.com/avatars/{}?size=64&overlay"
NAMEMC_PROFILE_URL = "https://namemc.com/profile/{}"

# Default adjectives
default_adjectives = ["Golden", "Fresh", "Hot", "Soft", "Crunchy", "Tasty"]

class MinecraftNameChecker:
    def __init__(self, root):
        self.root = root
        self.root.title("Minecraft Name Checker v3")
        self.adjectives = default_adjectives.copy()
        self.avatar_refs = []  # Keep references to Tk images

        # Single name input
        frame_single = tk.Frame(root)
        frame_single.pack(padx=10, pady=5, fill="x")
        tk.Label(frame_single, text="Enter a single name:").pack(anchor="w")
        self.single_name_entry = tk.Entry(frame_single)
        self.single_name_entry.pack(fill="x")

        # List of names input
        frame_list = tk.Frame(root)
        frame_list.pack(padx=10, pady=5, fill="x")
        tk.Label(frame_list, text="Or enter a list of names (one per line):").pack(anchor="w")
        self.list_text = scrolledtext.ScrolledText(frame_list, height=10)
        self.list_text.pack(fill="x")

        # Adjective toggle/edit
        frame_adj = tk.Frame(root)
        frame_adj.pack(padx=10, pady=5, fill="x")
        tk.Label(frame_adj, text="Adjectives (comma-separated, toggleable):").pack(anchor="w")
        self.adj_entry = tk.Entry(frame_adj)
        self.adj_entry.insert(0, ",".join(self.adjectives))
        self.adj_entry.pack(fill="x")
        self.use_adj_var = tk.BooleanVar(value=True)
        tk.Checkbutton(frame_adj, text="Use adjectives if name taken", variable=self.use_adj_var).pack(anchor="w")

        # Time rest toggle/edit
        frame_time = tk.Frame(root)
        frame_time.pack(padx=10, pady=5, fill="x")
        tk.Label(frame_time, text="Time rest between requests (seconds, toggleable):").pack(anchor="w")
        self.time_rest_var = tk.BooleanVar(value=False)
        tk.Checkbutton(frame_time, text="Use time rest", variable=self.time_rest_var).pack(anchor="w")
        self.time_rest_entry = tk.Entry(frame_time)
        self.time_rest_entry.insert(0, "0.35")
        self.time_rest_entry.pack(fill="x")

        # Buttons
        frame_buttons = tk.Frame(root)
        frame_buttons.pack(padx=10, pady=5, fill="x")
        tk.Button(frame_buttons, text="Check Names", command=self.check_names).pack(side="left", padx=5)
        tk.Button(frame_buttons, text="Clear Output", command=self.clear_output).pack(side="left", padx=5)
        tk.Button(frame_buttons, text="Save Results to File", command=self.save_results).pack(side="left", padx=5)

        # Output canvas (with scroll)
        self.canvas_frame = tk.Frame(root)
        self.canvas_frame.pack(fill="both", expand=True)
        self.canvas = tk.Canvas(self.canvas_frame)
        self.scrollbar = tk.Scrollbar(self.canvas_frame, orient="vertical", command=self.canvas.yview)
        self.scrollable_frame = tk.Frame(self.canvas)
        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all"))
        )
        self.canvas.create_window((0,0), window=self.scrollable_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")

        self.results = {}

    def check_name(self, name):
        """Check single Minecraft name using Mojang API."""
        try:
            resp = requests.get(API_URL.format(name), headers=HEADERS, timeout=5)
        except requests.RequestException:
            return "ERROR", None
        if resp.status_code == 200:
            return "TAKEN", resp.json()
        elif resp.status_code in [204, 404]:
            return "AVAILABLE", None
        else:
            return f"ERROR {resp.status_code}", None

    def add_result_row(self, name, status, uuid_text):
        """Add a row with name, status, UUID, NameMC link, and avatar if available."""
        frame = tk.Frame(self.scrollable_frame)
        frame.pack(fill="x", pady=2)

        tk.Label(frame, text=f"{name:16} — {status}").pack(side="left", padx=5)

        if uuid_text:
            # NameMC link
            link = NAMEMC_PROFILE_URL.format(name)
            link_label = tk.Label(frame, text="NameMC", fg="blue", cursor="hand2")
            link_label.pack(side="left", padx=5)
            link_label.bind("<Button-1>", lambda e, url=link: webbrowser.open(url))

            # Avatar image
            head_url = CRAFTATAR_HEAD_URL.format(uuid_text)
            try:
                img_resp = requests.get(head_url, timeout=5)
                img_data = img_resp.content
                img = Image.open(BytesIO(img_data))
                img_tk = ImageTk.PhotoImage(img)
                self.avatar_refs.append(img_tk)  # prevent garbage collection
                lbl_img = tk.Label(frame, image=img_tk, cursor="hand2")
                lbl_img.pack(side="left", padx=5)
                lbl_img.bind("<Button-1>", lambda e, url=link: webbrowser.open(url))
            except:
                pass

    def check_names(self):
        # Clear previous output
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
        self.avatar_refs = []
        self.results = {}

        # Gather names
        names = []
        single_name = self.single_name_entry.get().strip()
        if single_name:
            names.append(single_name)
        list_names = [n.strip() for n in self.list_text.get(1.0, tk.END).splitlines() if n.strip()]
        names.extend(list_names)

        if not names:
            messagebox.showwarning("No Names", "Please enter at least one name to check.")
            return

        adjectives_text = self.adj_entry.get()
        self.adjectives = [adj.strip() for adj in adjectives_text.split(",") if adj.strip()]
        use_adjectives = self.use_adj_var.get()
        use_time_rest = self.time_rest_var.get()
        try:
            time_rest = float(self.time_rest_entry.get())
        except ValueError:
            time_rest = 0.35

        for name in names:
            if len(name) > 16:
                self.add_result_row(name, "TOO LONG (>16)", "")
                continue

            status, info = self.check_name(name)
            uuid_text = info.get("id") if info else ""
            self.results[name] = (status, uuid_text)
            self.add_result_row(name, status, uuid_text)

            # If taken and adjectives enabled, try prepending adjectives
            if status == "TAKEN" and use_adjectives:
                for adj in self.adjectives:
                    variant = adj + name
                    if len(variant) <= 16:
                        v_status, v_info = self.check_name(variant)
                        v_uuid = v_info.get("id") if v_info else ""
                        self.results[variant] = (v_status, v_uuid)
                        self.add_result_row(variant, v_status, v_uuid)

                    if use_time_rest:
                        time.sleep(time_rest)

    def clear_output(self):
        for widget in self.scrollable_frame.winfo_children():
            widget.destroy()
        self.avatar_refs = []
        self.results = {}

    def save_results(self):
        if not self.results:
            messagebox.showinfo("No Results", "No results to save. Please check names first.")
            return
        file_path = filedialog.asksaveasfilename(defaultextension=".txt",
                                                 filetypes=[("Text files","*.txt")])
        if not file_path:
            return
        with open(file_path, "w", encoding="utf-8") as f:
            for name, (status, uuid_text) in self.results.items():
                link = NAMEMC_PROFILE_URL.format(name) if uuid_text else ""
                f.write(f"{name:16} — {status} {uuid_text} — {link}\n")
        messagebox.showinfo("Saved", f"Results saved to {file_path}")

if __name__ == "__main__":
    root = tk.Tk()
    app = MinecraftNameChecker(root)
    root.mainloop()
