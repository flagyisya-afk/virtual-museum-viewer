"""
desktop_widget_multi_account.py
pip install PyQt5
Supports multiple Gmail accounts with unread sum and account management.
"""

import sys
import ctypes
import imaplib
import time
import webbrowser
import threading
from PyQt5 import QtWidgets, QtCore, QtGui

# ===== CONFIG =====
ACCOUNTS = [
    {"email": "first@gmail.com", "password": "app_password1"},
    # {"email": "second@gmail.com", "password": "app_password2"},
]
IMAP_SERVER = "imap.gmail.com"
CHECK_INTERVAL = 20   # seconds between IMAP checks
FLASH_DURATION = 0.35
EMBED_DESKTOP = False
# ===================


class EmailThread(QtCore.QThread):
    unread_signal = QtCore.pyqtSignal(int)
    status_signal = QtCore.pyqtSignal(str)

    def __init__(self, email, password, imap_server, interval=20):
        super().__init__()
        self.email = email
        self.password = password
        self.imap_server = imap_server
        self.interval = interval
        self._running = True

    def run(self):
        while self._running:
            unread = 0
            status = "OK"
            try:
                mail = imaplib.IMAP4_SSL(self.imap_server)
                mail.login(self.email, self.password)
                mail.select("INBOX", readonly=True)
                result, data = mail.search(None, "UNSEEN")
                mail.logout()
                if result == "OK" and data and data[0]:
                    unread = len(data[0].split())
            except Exception as e:
                status = f"ERR ({self.email}): {e}"

            self.unread_signal.emit(unread)
            self.status_signal.emit(status)

            for _ in range(int(self.interval)):
                if not self._running:
                    break
                time.sleep(1)

    def stop(self):
        self._running = False
        self.wait()


class EmailManager(QtCore.QObject):
    total_unread_signal = QtCore.pyqtSignal(int)
    status_signal = QtCore.pyqtSignal(str)

    def __init__(self, accounts):
        super().__init__()
        self.accounts = accounts
        self.threads = []
        self.unread_counts = [0] * len(accounts)
        self.start_threads()

    def start_threads(self):
        self.stop_threads()
        self.threads = []
        self.unread_counts = [0] * len(self.accounts)
        for idx, acc in enumerate(self.accounts):
            t = EmailThread(acc["email"], acc["password"], IMAP_SERVER, CHECK_INTERVAL)
            t.unread_signal.connect(lambda u, i=idx: self.update_unread(u, i))
            t.status_signal.connect(self.status_signal.emit)
            t.start()
            self.threads.append(t)

    def update_unread(self, unread, idx):
        self.unread_counts[idx] = unread
        total = sum(self.unread_counts)
        self.total_unread_signal.emit(total)

    def add_account(self, email, password):
        self.accounts.append({"email": email, "password": password})
        self.start_threads()

    def stop_threads(self):
        for t in self.threads:
            t.stop()


class DesktopWidget(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self._dragging = False
        self._drag_offset = QtCore.QPoint()
        self._last_unread = 0
        self._is_flashing = False

        # Layout
        layout = QtWidgets.QHBoxLayout()
        layout.setContentsMargins(8, 8, 8, 8)
        layout.setSpacing(10)
        self.setLayout(layout)

        # Clock
        self.clock_label = QtWidgets.QLabel("--:--:--")
        self.clock_label.setAlignment(QtCore.Qt.AlignCenter)
        self.clock_label.setStyleSheet("""
            QLabel {
                color: white;
                font-size: 28px;
                font-weight: 600;
                background: rgba(0,0,0,0.35);
                padding: 6px 10px;
                border-radius: 8px;
            }
        """)
        layout.addWidget(self.clock_label)

        # Email alert
        self.alert_label = QtWidgets.QLabel()
        self.alert_label.setFixedSize(36, 36)
        self.alert_label.setCursor(QtGui.QCursor(QtCore.Qt.PointingHandCursor))
        self.alert_label.mousePressEvent = self.open_mail_menu
        layout.addWidget(self.alert_label)

        # Status
        self.status_label = QtWidgets.QLabel("")
        self.status_label.setStyleSheet("QLabel { color: #ddd; font-size: 10px; }")
        layout.addWidget(self.status_label, alignment=QtCore.Qt.AlignBottom)

        # Window flags
        self.setWindowFlags(
            QtCore.Qt.FramelessWindowHint |
            QtCore.Qt.WindowStaysOnBottomHint |
            QtCore.Qt.Tool
        )
        self.setAttribute(QtCore.Qt.WA_TranslucentBackground)
        self.move(150, 120)
        self.adjustSize()
        self.show()

        # Pixmap template
        self.alert_label.setPixmap(self._build_envelope_pixmap(36, 36, unread=0))

        # Clock timer
        timer = QtCore.QTimer(self)
        timer.timeout.connect(self.update_time)
        timer.start(1000)
        self.update_time()

        # Email manager
        self.manager = EmailManager(ACCOUNTS)
        self.manager.total_unread_signal.connect(self.on_unread)
        self.manager.status_signal.connect(self.on_status)

        # Optional embedding
        if EMBED_DESKTOP:
            try:
                ctypes.windll.user32.SetParent(int(self.winId()), ctypes.windll.user32.GetDesktopWindow())
            except Exception:
                pass

    # Clock
    def update_time(self):
        self.clock_label.setText(QtCore.QTime.currentTime().toString("HH:mm:ss"))

    # Email
    def _build_envelope_pixmap(self, w, h, unread=0):
        pm = QtGui.QPixmap(w, h)
        pm.fill(QtCore.Qt.transparent)
        p = QtGui.QPainter(pm)
        p.setRenderHint(QtGui.QPainter.Antialiasing)

        rect = QtCore.QRect(2, 6, w-4, h-12)
        p.setPen(QtCore.Qt.NoPen)
        p.setBrush(QtGui.QColor(245, 245, 245, 230))
        p.drawRoundedRect(rect, 4, 4)

        # flap
        p.setBrush(QtGui.QColor(210, 210, 210, 230))
        points = [QtCore.QPoint(2, 6), QtCore.QPoint(w//2, h-10), QtCore.QPoint(w-2, 6)]
        p.drawPolygon(QtGui.QPolygon(points))

        # outline
        p.setPen(QtGui.QPen(QtGui.QColor(100, 100, 100, 200), 1))
        p.setBrush(QtCore.Qt.NoBrush)
        p.drawRoundedRect(rect, 4, 4)

        # unread badge
        if unread > 0:
            badge_rect = QtCore.QRect(w - 18, 2, 16, 16)
            p.setBrush(QtGui.QColor(220, 40, 40))
            p.setPen(QtCore.Qt.NoPen)
            p.drawEllipse(badge_rect)

            font = QtGui.QFont("Arial", 9, QtGui.QFont.Bold)
            p.setFont(font)
            p.setPen(QtGui.QColor("white"))
            text = str(unread if unread < 100 else "99+")
            p.drawText(badge_rect, QtCore.Qt.AlignCenter, text)

        p.end()
        return pm

    @QtCore.pyqtSlot(int)
    def on_unread(self, total):
        self.alert_label.setPixmap(self._build_envelope_pixmap(36, 36, unread=total))
        if total > self._last_unread:
            self._flash_alert()
        self._last_unread = total

    @QtCore.pyqtSlot(str)
    def on_status(self, status):
        if status.startswith("ERR"):
            self.status_label.setText(status)
        else:
            self.status_label.clear()

    def _flash_alert(self):
        if self._is_flashing:
            return
        self._is_flashing = True

        def flasher():
            for _ in range(4):
                # off
                QtCore.QMetaObject.invokeMethod(
                    self.alert_label, "setPixmap",
                    QtCore.Qt.QueuedConnection,
                    QtCore.Q_ARG(QtGui.QPixmap, self._build_envelope_pixmap(36, 36, unread=0))
                )
                time.sleep(FLASH_DURATION)
                # on
                QtCore.QMetaObject.invokeMethod(
                    self.alert_label, "setPixmap",
                    QtCore.Qt.QueuedConnection,
                    QtCore.Q_ARG(QtGui.QPixmap, self._build_envelope_pixmap(36, 36, unread=self._last_unread))
                )
                time.sleep(FLASH_DURATION)
            # restore actual unread count
            QtCore.QMetaObject.invokeMethod(
                self.alert_label, "setPixmap",
                QtCore.Qt.QueuedConnection,
                QtCore.Q_ARG(QtGui.QPixmap, self._build_envelope_pixmap(36, 36, unread=self._last_unread))
            )
            self._is_flashing = False

        threading.Thread(target=flasher, daemon=True).start()

    # Drag
    def mousePressEvent(self, event):
        if event.button() == QtCore.Qt.LeftButton:
            self._dragging = True
            self._drag_offset = event.globalPos() - self.frameGeometry().topLeft()
            event.accept()

    def mouseMoveEvent(self, event):
        if self._dragging:
            self.move(event.globalPos() - self._drag_offset)
            event.accept()

    def mouseReleaseEvent(self, event):
        if event.button() == QtCore.Qt.LeftButton:
            self._dragging = False
            event.accept()

    # Mail icon click
    def open_mail_menu(self, event):
        menu = QtWidgets.QMenu()
        menu.addAction("Open Gmail", lambda: webbrowser.open("https://mail.google.com"))
        menu.addAction("Add Account", self.add_account_dialog)
        menu.exec_(QtGui.QCursor.pos())

    def add_account_dialog(self):
        email, ok1 = QtWidgets.QInputDialog.getText(self, "Add Account", "Email:")
        if not ok1 or not email:
            return
        password, ok2 = QtWidgets.QInputDialog.getText(
            self, "Add Account", "App Password:", QtWidgets.QLineEdit.Password
        )
        if not ok2 or not password:
            return
        self.manager.add_account(email, password)

    def closeEvent(self, event):
        self.manager.stop_threads()
        super().closeEvent(event)


def main():
    app = QtWidgets.QApplication(sys.argv)
    DesktopWidget()
    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
