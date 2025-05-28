#!/usr/bin/env bash

ln titties-on-boot.service /etc/systemd/system/titties-on-boot.service

systemctl stop titties-on-boot.service
systemctl disable titties-on-boot.service
systemctl daemon-reload
systemctl enable titties-on-boot.service
systemctl start titties-on-boot.service

echo "Titties on boot service installed and started."
echo "You can check the status of the service with:"
echo "systemctl status titties-on-boot.service"
