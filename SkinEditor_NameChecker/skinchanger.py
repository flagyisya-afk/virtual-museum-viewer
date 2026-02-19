import tkinter as tk
from tkinter import filedialog, messagebox
import requests
import json
import os

minecraft_token = None
player_profile = {}
launcher_accounts_path = os.path.expandvars(r"%appdata%\.minecraft\launcher_accounts.json")

# -----------------------------
# TOKEN FUNCTIONS
# -----------------------------
def detect_accounts():
    if not os.path.exists(launcher_accounts_path):
        messagebox.showerror("Error", f"Launcher accounts file not found:\n{launcher_accounts_path}")
        return
    with open(launcher_accounts_path, "r") as f:
        data = json.load(f)
    accounts = []
    for acc in data.get("accounts", {}).values():
        display_name = acc.get("minecraftProfile", {}).get("name", "Unknown")
        token = acc.get("accessToken")
        accounts.append((display_name, token))
    if not accounts:
        messagebox.showerror("Error", "No Minecraft accounts found in launcher file!")
        return
    # Populate dropdown
    account_menu["menu"].delete(0, "end")
    for name, token in accounts:
        account_menu["menu"].add_command(label=name, command=lambda t=token: set_token(t))
    log(f"Detected {len(accounts)} account(s). Select from dropdown.")

def set_token(token=None):
    global minecraft_token
    if token is None:
        token = token_entry.get().strip()
    if not token:
        messagebox.showerror("Error", "No token provided!")
        return
    minecraft_token = token
    log("Token set successfully!")

# -----------------------------
# PROFILE FUNCTIONS
# -----------------------------
def get_profile():
    global player_profile
    if not minecraft_token:
        messagebox.showerror("Error", "Token not set!")
        return
    headers = {"Authorization": f"Bearer {minecraft_token}"}
    resp = requests.get("https://api.minecraftservices.com/minecraft/profile", headers=headers)
    if resp.status_code != 200:
        log(f"Failed to fetch profile: {resp.text}")
        return
    player_profile = resp.json()
    log(f"Profile loaded: {player_profile.get('name')} ({player_profile.get('id')})")
    update_gui_profile()

def change_name():
    if not minecraft_token:
        messagebox.showerror("Error", "Token not set!")
        return
    new_name = name_entry.get().strip()
    if len(new_name) > 16:
        messagebox.showerror("Error", "Name too long!")
        return
    headers = {"Authorization": f"Bearer {minecraft_token}"}
    resp = requests.put(f"https://api.minecraftservices.com/minecraft/profile/name/{new_name}", headers=headers)
    if resp.status_code == 200:
        log(f"Name changed successfully to {new_name}")
        get_profile()
    else:
        log(f"Failed to change name: {resp.text}")

def upload_skin():
    if not minecraft_token:
        messagebox.showerror("Error", "Token not set!")
        return
    path = filedialog.askopenfilename(filetypes=[("PNG Images", "*.png")])
    if not path:
        return
    variant = variant_var.get()
    headers = {"Authorization": f"Bearer {minecraft_token}"}
    files = {"variant": (None, variant), "file": ("skin.png", open(path, "rb"), "image/png")}
    resp = requests.post("https://api.minecraftservices.com/minecraft/profile/skins", headers=headers, files=files)
    if resp.status_code == 200:
        log(f"Skin uploaded successfully ({variant})!")
        get_profile()
    else:
        log(f"Failed to upload skin: {resp.text}")

def reset_skin():
    if not minecraft_token:
        messagebox.showerror("Error", "Token not set!")
        return
    headers = {"Authorization": f"Bearer {minecraft_token}"}
    resp = requests.delete("https://api.minecraftservices.com/minecraft/profile/skins/active", headers=headers)
    if resp.status_code == 200:
        log("Skin reset successfully!")
        get_profile()
    else:
        log(f"Failed to reset skin: {resp.text}")

# -----------------------------
# GUI LOG
# -----------------------------
def log(msg):
    log_text.config(state="normal")
    log_text.insert("end", msg + "\n")
    log_text.see("end")
    log_text.config(state="disabled")

def update_gui_profile():
    profile_name_var.set(player_profile.get("name", ""))
    profile_uuid_var.set(player_profile.get("id", ""))

# -----------------------------
# TKINTER GUI
# -----------------------------
root = tk.Tk()
root.title("Minecraft Skin & Name Manager")

# Token input
tk.Label(root, text="Paste Access Token:").grid(row=0, column=0, sticky="w")
token_entry = tk.Entry(root, width=50)
token_entry.grid(row=0, column=1)
tk.Button(root, text="Set Token", command=lambda: set_token()).grid(row=0, column=2)
tk.Button(root, text="Detect Accounts", command=detect_accounts).grid(row=0, column=3)

# Account selection dropdown
account_var = tk.StringVar()
account_menu = tk.OptionMenu(root, account_var, "")
account_menu.grid(row=1, column=1, sticky="w")

# Profile info
profile_name_var = tk.StringVar()
profile_uuid_var = tk.StringVar()
tk.Label(root, text="Name:").grid(row=2, column=0, sticky="e")
tk.Entry(root, textvariable=profile_name_var, state="readonly").grid(row=2, column=1)
tk.Label(root, text="UUID:").grid(row=3, column=0, sticky="e")
tk.Entry(root, textvariable=profile_uuid_var, state="readonly").grid(row=3, column=1)
tk.Button(root, text="Refresh Profile", command=get_profile).grid(row=3, column=2)

# Change name
tk.Label(root, text="New Name:").grid(row=4, column=0, sticky="e")
name_entry = tk.Entry(root)
name_entry.grid(row=4, column=1)
tk.Button(root, text="Change Name", command=change_name).grid(row=4, column=2)

# Upload/reset skin
variant_var = tk.StringVar(value="classic")
tk.OptionMenu(root, variant_var, "classic", "slim").grid(row=5, column=0)
tk.Button(root, text="Upload Skin", command=upload_skin).grid(row=5, column=1)
tk.Button(root, text="Reset Skin", command=reset_skin).grid(row=5, column=2)

# Log box
log_text = tk.Text(root, height=15, width=90, state="disabled")
log_text.grid(row=6, column=0, columnspan=4, pady=10)

root.mainloop()
