# minecraft_name_checker_v12.py
# Requires: pip install requests pillow
# v12: Threaded safe requests, retry, random delay, settings popup, all v11 features

import tkinter as tk
from tkinter import scrolledtext, messagebox, filedialog
import requests
import webbrowser
from PIL import Image, ImageTk
from io import BytesIO
import threading
import time
import random
from concurrent.futures import ThreadPoolExecutor, as_completed

API_URL = "https://api.mojang.com/users/profiles/minecraft/{}"
HEADERS = {"User-Agent": "MinecraftNameChecker/1.0"}
CRAFTATAR_HEAD_URL = "https://crafatar.com/avatars/{}?size=32&overlay"
NAMEMC_PROFILE_URL = "https://namemc.com/profile/{}"

default_adjectives = ["Golden", "Fresh", "Hot", "Soft", "Crunchy", "Tasty"]

class MinecraftNameCheckerV12:
    def __init__(self, root):
        self.root = root
        self.root.title("Minecraft Name Checker v12")
        self.adjectives = default_adjectives.copy()
        self.avatar_refs = []
        self.results = {}
        self.row_widgets = {}
        self.settings = {
            "max_threads": 20,
            "delay_min": 0.2,
            "delay_max": 0.5,
            "retry_enabled": True,
            "retry_count": 1,
            "time_rest": 0.35
        }

        # Clock
        self.clock_label = tk.Label(root, font=('Helvetica', 14), fg='black')
        self.clock_label.pack(side="top", pady=4)
        self.update_clock()

        # Search
        search_frame = tk.Frame(root)
        search_frame.pack(fill="x", padx=8, pady=(0,6))
        tk.Label(search_frame, text="Search:").pack(side="left")
        self.search_entry = tk.Entry(search_frame)
        self.search_entry.pack(side="left", fill="x", expand=True, padx=6)
        self.search_entry.bind("<KeyRelease>", lambda e: self.apply_filters())

        # Controls
        controls = tk.Frame(root)
        controls.pack(fill="x", padx=8)

        left_col = tk.Frame(controls)
        left_col.pack(side="left", fill="both", expand=True, padx=4)
        tk.Label(left_col, text="Single name:").pack(anchor="w")
        self.single_name_entry = tk.Entry(left_col)
        self.single_name_entry.pack(fill="x")
        tk.Label(left_col, text="Or paste a list (one per line):").pack(anchor="w", pady=(6,0))
        self.list_text = scrolledtext.ScrolledText(left_col, height=6)
        self.list_text.pack(fill="both", expand=True)

        right_col = tk.Frame(controls, width=280)
        right_col.pack(side="right", fill="y", padx=4)
        tk.Label(right_col, text="Adjectives (comma-separated):").pack(anchor="w")
        self.adj_entry = tk.Entry(right_col)
        self.adj_entry.insert(0, ",".join(self.adjectives))
        self.adj_entry.pack(fill="x")
        self.use_adj_var = tk.BooleanVar(value=False)
        tk.Checkbutton(right_col, text="Use adjectives if name taken", variable=self.use_adj_var).pack(anchor="w", pady=(4,0))

        tk.Label(right_col, text="Time rest (display only):").pack(anchor="w", pady=(8,0))
        self.time_rest_var = tk.BooleanVar(value=False)
        tk.Checkbutton(right_col, text="Show time rest", variable=self.time_rest_var).pack(anchor="w")
        self.time_rest_entry = tk.Entry(right_col)
        self.time_rest_entry.insert(0, str(self.settings["time_rest"]))
        self.time_rest_entry.pack(fill="x")

        tk.Label(right_col, text="Filters:").pack(anchor="w", pady=(8,0))
        self.filter_avail_var = tk.BooleanVar(value=True)
        self.filter_taken_var = tk.BooleanVar(value=True)
        tk.Checkbutton(right_col, text="Show AVAILABLE", variable=self.filter_avail_var, command=self.apply_filters).pack(anchor="w")
        tk.Checkbutton(right_col, text="Show NON-AVAILABLE", variable=self.filter_taken_var, command=self.apply_filters).pack(anchor="w")

        # Buttons
        btn_frame = tk.Frame(root)
        btn_frame.pack(fill="x", padx=8, pady=(6,4))
        tk.Button(btn_frame, text="Check Names", command=self.check_names_threaded).pack(side="left", padx=6)
        tk.Button(btn_frame, text="Clear Output", command=self.clear_output).pack(side="left", padx=6)
        tk.Button(btn_frame, text="Save Results to File", command=self.save_results).pack(side="left", padx=6)
        tk.Button(btn_frame, text="Export ONLY Available", command=self.save_only_available).pack(side="left", padx=6)
        tk.Button(btn_frame, text="Settings", command=self.open_settings).pack(side="left", padx=6)

        # Output area
        self.canvas_frame = tk.Frame(root)
        self.canvas_frame.pack(fill="both", expand=True, padx=8, pady=(0,4))
        self.canvas = tk.Canvas(self.canvas_frame)
        self.scrollbar = tk.Scrollbar(self.canvas_frame, orient="vertical", command=self.canvas.yview)
        self.scrollable_frame = tk.Frame(self.canvas)
        self.scrollable_frame.bind("<Configure>", lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")))
        self.canvas.create_window((0,0), window=self.scrollable_frame, anchor="nw")
        self.canvas.configure(yscrollcommand=self.scrollbar.set)
        self.canvas.pack(side="left", fill="both", expand=True)
        self.scrollbar.pack(side="right", fill="y")

        # Log box
        tk.Label(root, text="Log:").pack(anchor="w", padx=8)
        self.log_box = scrolledtext.ScrolledText(root, height=6, state="disabled")
        self.log_box.pack(fill="x", padx=8, pady=(0,8))

    # ---------- Utilities ----------
    def log(self, msg):
        self.log_box.config(state="normal")
        self.log_box.insert(tk.END, f"{msg}\n")
        self.log_box.see(tk.END)
        self.log_box.config(state="disabled")

    def update_clock(self):
        from time import strftime
        self.clock_label.config(text=strftime('%H:%M:%S'))
        self.root.after(1000, self.update_clock)

    def check_name_mojang(self, name):
        try:
            resp = requests.get(API_URL.format(name), headers=HEADERS, timeout=5)
        except:
            return "ERROR", None
        if resp.status_code == 200:
            try:
                return "TAKEN", resp.json()
            except:
                return "TAKEN", None
        elif resp.status_code in (204, 404):
            return "AVAILABLE", None
        else:
            return f"ERROR {resp.status_code}", None

    def check_name_with_retry(self, name):
        for attempt in range(self.settings["retry_count"] + 1):
            status, info = self.check_name_mojang(name)
            if status.startswith("ERROR") and self.settings["retry_enabled"] and attempt < self.settings["retry_count"]:
                time.sleep(random.uniform(self.settings["delay_min"], self.settings["delay_max"]))
                continue
            return status, info
        return "ERROR", None

    def add_result_row(self, idx, name, status, uuid_text):
        frame = tk.Frame(self.scrollable_frame, bd=0)
        frame.pack(fill="x", pady=1)
        frame.status = status
        frame.name = name
        self.row_widgets[name] = frame

        left_text = f"{idx:03d}. {name:16} — {status}"
        tk.Label(frame, text=left_text, width=42, anchor="w").pack(side="left", padx=4)

        if uuid_text:
            uuid_short = uuid_text[:8] + "..."
            tk.Label(frame, text=f"UUID: {uuid_short}").pack(side="left", padx=4)
            link = NAMEMC_PROFILE_URL.format(name)
            link_label = tk.Label(frame, text="NameMC", fg="blue", cursor="hand2")
            link_label.pack(side="left", padx=4)
            link_label.bind("<Button-1>", lambda e, url=link: webbrowser.open(url))
            head_url = CRAFTATAR_HEAD_URL.format(uuid_text)
            try:
                img = Image.open(BytesIO(requests.get(head_url, timeout=5).content))
                img_tk = ImageTk.PhotoImage(img)
                self.avatar_refs.append(img_tk)
                img_lbl = tk.Label(frame, image=img_tk, cursor="hand2")
                img_lbl.pack(side="left", padx=4)
                img_lbl.bind("<Button-1>", lambda e, url=link: webbrowser.open(url))
            except:
                pass

    # ---------- Filters ----------
    def apply_filters(self):
        query = self.search_entry.get().lower().strip()
        show_avail = self.filter_avail_var.get()
        show_taken = self.filter_taken_var.get()

        for name, frame in self.row_widgets.items():
            match = (query in name.lower()) if query else True
            if frame.status == "AVAILABLE" and not show_avail:
                frame.pack_forget()
            elif frame.status == "TAKEN" and not show_taken:
                frame.pack_forget()
            elif match:
                frame.pack(fill="x", pady=1)
            else:
                frame.pack_forget()
        self.log(f"Applied filters. Query='{query}' Avail={show_avail} Taken={show_taken}")

    # ---------- Main Check ----------
    def check_names_threaded(self):
        t = threading.Thread(target=self.check_names, daemon=True)
        t.start()

    def check_names(self):
        self.clear_output(keep_filters=True)
        names = []
        single = self.single_name_entry.get().strip()
        if single:
            names.append(single)
        names += [n.strip() for n in self.list_text.get(1.0, tk.END).splitlines() if n.strip()]
        if not names:
            messagebox.showwarning("No Names", "Enter at least one name.")
            return

        self.log(f"Starting check for {len(names)} names...")
        self.adjectives = [a.strip() for a in self.adj_entry.get().split(",") if a.strip()]
        use_adj = self.use_adj_var.get()

        # ThreadPool
        futures = []
        with ThreadPoolExecutor(max_workers=self.settings["max_threads"]) as executor:
            for name in names:
                if len(name) > 16:
                    self.results[name] = {"status": "TOO LONG", "uuid": ""}
                    self.log(f"Skipped {name} (too long).")
                    continue
                futures.append(executor.submit(self.check_name_with_retry, name))

            for future, name in zip(futures, [n for n in names if len(n)<=16]):
                status, info = future.result()
                uuid_text = info.get("id") if isinstance(info, dict) else ""
                self.results[name] = {"status": status, "uuid": uuid_text}
                self.log(f"Checked {name}: {status}")

                if status == "TAKEN" and use_adj:
                    for adj in self.adjectives:
                        variant = adj + name
                        if len(variant) <= 16:
                            v_status, v_info = self.check_name_with_retry(variant)
                            v_uuid = v_info.get("id") if isinstance(v_info, dict) else ""
                            self.results[variant] = {"status": v_status, "uuid": v_uuid}
                            self.log(f"Checked variant {variant}: {v_status}")

        # Sort + display
        sorted_names = sorted(self.results.keys())
        for idx, name in enumerate(sorted_names, start=1):
            info = self.results[name]
            self.add_result_row(idx, name, info['status'], info['uuid'])

        self.apply_filters()
        self.log("Finished checking names.")

    # ---------- Helpers ----------
    def clear_output(self, keep_filters=False):
        for w in self.scrollable_frame.winfo_children():
            w.destroy()
        self.row_widgets = {}
        self.avatar_refs = []
        if not keep_filters:
            self.results = {}
        self.log("Cleared output.")

    def save_results(self):
        if not self.results:
            messagebox.showinfo("No Results", "No results to save.")
            return
        path = filedialog.asksaveasfilename(defaultextension=".txt")
        if not path:
            return
        with open(path, "w", encoding="utf-8") as f:
            for idx, name in enumerate(sorted(self.results.keys()), start=1):
                info = self.results[name]
                status, uuid = info.get("status",""), info.get("uuid","")
                link = NAMEMC_PROFILE_URL.format(name) if uuid else ""
                f.write(f"{idx:03d}. {name:20} — {status:10} {uuid:36} {link}\n")
        self.log(f"Results saved to {path}")

    def save_only_available(self):
        if not self.results:
            messagebox.showinfo("No Results", "No results to save.")
            return
        path = filedialog.asksaveasfilename(defaultextension=".txt")
        if not path:
            return
        with open(path, "w", encoding="utf-8") as f:
            for idx, name in enumerate(sorted(self.results.keys()), start=1):
                info = self.results[name]
                if info.get("status") == "AVAILABLE":
                    uuid = info.get("uuid","")
                    link = NAMEMC_PROFILE_URL.format(name) if uuid else ""
                    f.write(f"{idx:03d}. {name:20} — AVAILABLE   {uuid:36} {link}\n")
        self.log(f"Only-AVAILABLE results saved to {path}")

    # ---------- Settings Popup ----------
    def open_settings(self):
        popup = tk.Toplevel(self.root)
        popup.title("Settings")
        popup.geometry("250x350")
        tk.Label(popup, text="Max Threads:").pack(anchor="w", padx=8, pady=(6,0))
        threads_entry = tk.Entry(popup)
        threads_entry.insert(0, str(self.settings["max_threads"]))
        threads_entry.pack(fill="x", padx=8)

        tk.Label(popup, text="Random Delay Min (s):").pack(anchor="w", padx=8, pady=(6,0))
        delay_min_entry = tk.Entry(popup)
        delay_min_entry.insert(0, str(self.settings["delay_min"]))
        delay_min_entry.pack(fill="x", padx=8)

        tk.Label(popup, text="Random Delay Max (s):").pack(anchor="w", padx=8, pady=(6,0))
        delay_max_entry = tk.Entry(popup)
        delay_max_entry.insert(0, str(self.settings["delay_max"]))
        delay_max_entry.pack(fill="x", padx=8)

        retry_var = tk.BooleanVar(value=self.settings["retry_enabled"])
        tk.Checkbutton(popup, text="Retry Failed Requests", variable=retry_var).pack(anchor="w", padx=8, pady=(6,0))
        tk.Label(popup, text="Retry Count:").pack(anchor="w", padx=8, pady=(4,0))
        retry_count_entry = tk.Entry(popup)
        retry_count_entry.insert(0, str(self.settings["retry_count"]))
        retry_count_entry.pack(fill="x", padx=8)

        tk.Label(popup, text="Time Rest Display (s):").pack(anchor="w", padx=8, pady=(6,0))
        time_rest_entry = tk.Entry(popup)
        time_rest_entry.insert(0, str(self.settings["time_rest"]))
        time_rest_entry.pack(fill="x", padx=8)

        def save_settings():
            try:
                self.settings["max_threads"] = max(1, int(threads_entry.get()))
                self.settings["delay_min"] = float(delay_min_entry.get())
                self.settings["delay_max"] = float(delay_max_entry.get())
                self.settings["retry_enabled"] = retry_var.get()
                self.settings["retry_count"] = max(0, int(retry_count_entry.get()))
                self.settings["time_rest"] = float(time_rest_entry.get())
                self.time_rest_entry.delete(0, tk.END)
                self.time_rest_entry.insert(0, str(self.settings["time_rest"]))
                popup.destroy()
                self.log("Settings updated.")
            except Exception as e:
                messagebox.showerror("Error", f"Invalid input: {e}")

        tk.Button(popup, text="Save Settings", command=save_settings).pack(pady=8)
        tk.Button(popup, text="Cancel", command=popup.destroy).pack()

# ---------- Run ----------
if __name__ == "__main__":
    root = tk.Tk()
    app = MinecraftNameCheckerV12(root)
    root.geometry("1000x720")
    root.mainloop()
