# minecraft_name_checker_gui_v12_win.py
# Requires: pip install requests pillow
# v12 Win: fixed search & scroll issues
# v12.1: fixed avatar loading (mc-heads fallback)

import tkinter as tk
from tkinter import scrolledtext, messagebox, filedialog
import requests
import webbrowser
from PIL import Image, ImageTk
from io import BytesIO
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import random

API_URL = "https://api.mojang.com/users/profiles/minecraft/{}"
HEADERS = {"User-Agent": "MinecraftNameChecker/1.0"}

# Avatar services (fallback order)
HEAD_SERVICES = [
    "https://mc-heads.net/avatar/{}/16",                     # primary (stable)
    "https://crafatar.com/avatars/{}?size=8&overlay"     # fallback
]

NAMEMC_PROFILE_URL = "https://namemc.com/profile/{}"

default_adjectives = ["Golden", "Fresh", "Hot", "Soft", "Crunchy", "Tasty"]

SETTINGS = {
    "max_threads": 20,
    "delay_min": 0.00,
    "delay_max": 0.5,
    "retry_enabled": True,
    "retry_count": 2,
    "time_rest_display": 0.1
}

class MinecraftNameChecker:
    def __init__(self, root):
        self.root = root
        self.root.title("Minecraft Name Checker v12 Windows")
        self.adjectives = default_adjectives.copy()
        self.avatar_refs = []
        self.results = {}
        self.row_widgets = {}

        self.clock_label = tk.Label(root, font=('Helvetica', 14), fg='blue')
        self.clock_label.pack(side="top", pady=4)
        self.update_clock()

        search_frame = tk.Frame(root)
        search_frame.pack(fill="x", padx=8, pady=(0,6))
        tk.Label(search_frame, text="Search:").pack(side="left")
        self.search_entry = tk.Entry(search_frame)
        self.search_entry.pack(side="left", fill="x", expand=True, padx=6)
        self.search_entry.bind("<KeyRelease>", lambda e: self.apply_filters())

        input_frame = tk.Frame(root)
        input_frame.pack(fill="x", padx=8, pady=(0,4))
        left_col = tk.Frame(input_frame)
        left_col.pack(side="left", fill="both", expand=True, padx=4)

        tk.Label(left_col, text="Single name:").pack(anchor="w")
        self.single_name_entry = tk.Entry(left_col)
        self.single_name_entry.pack(fill="x")

        tk.Label(left_col, text="Or paste a list (one per line):").pack(anchor="w", pady=(6,0))
        self.list_text = scrolledtext.ScrolledText(left_col, height=6)
        self.list_text.pack(fill="both", expand=True)

        right_col = tk.Frame(input_frame, width=260)
        right_col.pack(side="right", fill="y", padx=4)
        tk.Label(right_col, text="Adjectives (comma-separated):").pack(anchor="w")
        self.adj_entry = tk.Entry(right_col)
        self.adj_entry.insert(0, ",".join(self.adjectives))
        self.adj_entry.pack(fill="x")

        self.use_adj_var = tk.BooleanVar(value=False)
        tk.Checkbutton(
            right_col,
            text="Use adjectives if name taken",
            variable=self.use_adj_var
        ).pack(anchor="w", pady=(4,0))

        tk.Label(right_col, text="Filters:").pack(anchor="w", pady=(8,0))
        self.filter_avail_var = tk.BooleanVar(value=True)
        self.filter_taken_var = tk.BooleanVar(value=True)

        tk.Checkbutton(
            right_col,
            text="Show AVAILABLE",
            variable=self.filter_avail_var,
            command=self.apply_filters
        ).pack(anchor="w")

        tk.Checkbutton(
            right_col,
            text="Show NON-AVAILABLE",
            variable=self.filter_taken_var,
            command=self.apply_filters
        ).pack(anchor="w")

        btn_frame = tk.Frame(root)
        btn_frame.pack(fill="x", padx=8, pady=(6,4))

        tk.Button(btn_frame, text="Check Names", command=self.check_names_threaded).pack(side="left", padx=6)
        tk.Button(btn_frame, text="Clear Output", command=self.clear_output).pack(side="left", padx=6)
        tk.Button(btn_frame, text="Clear Inputs", command=self.clear_inputs).pack(side="left", padx=6)
        tk.Button(btn_frame, text="Save Results to File", command=self.save_results).pack(side="left", padx=6)
        tk.Button(btn_frame, text="Export ONLY Available", command=self.save_only_available).pack(side="left", padx=6)

        self.canvas_frame = tk.Frame(root)
        self.canvas_frame.pack(fill="both", expand=True, padx=8, pady=(0,4))

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

        self.canvas.bind_all("<MouseWheel>", self._on_mousewheel)

        tk.Label(root, text="Log:").pack(anchor="w", padx=8)
        self.log_box = scrolledtext.ScrolledText(root, height=6, state="disabled")
        self.log_box.pack(fill="x", padx=8, pady=(0,8))

    def _on_mousewheel(self, event):
        self.canvas.yview_scroll(int(-1*(event.delta/120)), "units")

    def log(self, msg):
        self.log_box.config(state="normal")
        self.log_box.insert(tk.END, msg + "\n")
        self.log_box.see(tk.END)
        self.log_box.config(state="disabled")

    def update_clock(self):
        from time import strftime
        self.clock_label.config(text=strftime('%H:%M:%S'))
        self.root.after(1000, self.update_clock)

    def check_name_mojang(self, name):
        try:
            r = requests.get(API_URL.format(name), headers=HEADERS, timeout=5)
            if r.status_code == 200:
                return "TAKEN", r.json()
            if r.status_code in (204, 404):
                return "AVAILABLE", None
        except:
            pass
        return "ERROR", None

    def load_avatar(self, identifier):
        for url_tpl in HEAD_SERVICES:
            try:
                r = requests.get(url_tpl.format(identifier), headers=HEADERS, timeout=5)
                r.raise_for_status()
                return Image.open(BytesIO(r.content)).convert("RGBA")
            except:
                continue
        return None

    def add_result_row(self, idx, name, status, uuid_text):
        frame = tk.Frame(self.scrollable_frame)
        frame.grid(row=idx, column=0, sticky="w", pady=1)
        frame.status = status
        frame.name = name
        self.row_widgets[name] = frame

        tk.Label(
            frame,
            text=f"{idx:03d}. {name:8} — {status}",
            width=42,
            anchor="w"
        ).grid(row=0, column=0, padx=4)

        if uuid_text:
            link = NAMEMC_PROFILE_URL.format(name)

            img = self.load_avatar(uuid_text)
            if img:
                img_tk = ImageTk.PhotoImage(img)
                self.avatar_refs.append(img_tk)
                lbl = tk.Label(frame, image=img_tk, cursor="hand2")
                lbl.grid(row=0, column=1, padx=4)
                lbl.bind("<Button-1>", lambda e, url=link: webbrowser.open(url))
            else:
                self.log(f"Avatar failed for {name}")

    def apply_filters(self):
        q = self.search_entry.get().lower().strip()
        for name, frame in self.row_widgets.items():
            show = q in name.lower() if q else True
            frame.grid() if show else frame.grid_remove()

    def check_names_threaded(self):
        threading.Thread(target=self.check_names, daemon=True).start()

    def check_names(self):
        self.clear_output(True)
        names = [n.strip() for n in (
            [self.single_name_entry.get()] +
            self.list_text.get(1.0, tk.END).splitlines()
        ) if n.strip()]

        for idx, name in enumerate(names, 1):
            status, info = self.check_name_mojang(name)
            uuid = info.get("id") if info else ""
            self.results[name] = {"status": status, "uuid": uuid}
            self.add_result_row(idx, name, status, uuid)

    def clear_output(self, keep_filters=False):
        for w in self.scrollable_frame.winfo_children():
            w.destroy()
        self.avatar_refs.clear()
        self.row_widgets.clear()
        if not keep_filters:
            self.results.clear()

    def save_results(self): pass
    def save_only_available(self): pass
    def clear_inputs(self): pass
    def open_settings(self): pass

if __name__ == "__main__":
    root = tk.Tk()
    app = MinecraftNameChecker(root)
    root.geometry("1000x720")
    root.mainloop()
