@echo off
del _seznam2.txt
dir /b *.tex > _seznam.txt
for /f %%1 in (_seznam.txt) do (echo \add{%%1}) >> _seznam2.txt
exit