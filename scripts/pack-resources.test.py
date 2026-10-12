import importlib.util, pathlib, tempfile, unittest, zipfile, json
spec = importlib.util.spec_from_file_location('pack', pathlib.Path(__file__).with_name('pack-resources.py'))
pack = importlib.util.module_from_spec(spec); spec.loader.exec_module(pack)
class PackTests(unittest.TestCase):
    def test_reuse_and_resource_only_boundary(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory); (root/'resources').mkdir(); (root/'resources/model.bin').write_bytes(b'model'); (root/'index.html').write_text('program')
            archive = pack.build(root, root/'output', ['resources'])
            stamp = archive.stat().st_mtime_ns
            self.assertEqual(pack.build(root, root/'output', ['resources']), archive)
            self.assertEqual(archive.stat().st_mtime_ns, stamp)
            with zipfile.ZipFile(archive) as z:
                self.assertEqual(set(z.namelist()), {'manifest.json', 'web/resources/model.bin'})
                self.assertEqual(json.loads(z.read('manifest.json'))['format'], 1)
            (root/'resources/model.bin').write_bytes(b'updated')
            self.assertNotEqual(pack.build(root, root/'output', ['resources']), archive)
if __name__ == '__main__': unittest.main()
