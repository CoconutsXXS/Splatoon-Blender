import bpy
import os
path = '/Users/coconuts/Desktop/Projets/Splatoon-Blender/resources/Locker/'
final = '['
for a in sorted(os.listdir(path)):
    final += "'"+a+"',"