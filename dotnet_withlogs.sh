#!/bin/sh

[ -d /var/log/dotnet ] || mkdir /var/log/dotnet

timestamp=$(date +%Y%m%d)
dotnet $@ >> /var/log/dotnet/${timestamp}.log 2>&1