class Zip {

    constructor(name) {
        this.name = name;
        this.zip = new Array();
        this.file = new Array();
    }
    
    str2dec=str=>Array.from(new TextEncoder().encode(str));
    crc32=r=>{
        let crc = 0xffffffff;
        for (const byte of r) {
            let value = (crc ^ byte) & 0xff;
            for (let bit = 0; bit < 8; bit++) {
                value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
            }
            crc = (crc >>> 8) ^ value;
        }
        return (crc ^ 0xffffffff) >>> 0;
    }
    
    async fecth2zip(filesArray,folder='')
    {
        for(var f of filesArray)
        {
            var fileUrl = f.path
            let resp;               
            var response = await fetch(fileUrl)
            if (!response.ok) {
                throw new Error(`Failed to download ${fileUrl}: HTTP ${response.status}`)
            }

            resp=response;
            var buffer = await response.arrayBuffer()
            let uint=[...new Uint8Array(buffer)];
            uint.modTime=resp.headers.get('Last-Modified');
            uint.fileUrl=`${this.name}/${folder}${f.name}`;

            this.zip[fileUrl]=uint;
        };
    }

    fecth2zipold(filesArray,folder=''){
		filesArray.forEach(fileUrl=>{
			let resp;				
			fetch(fileUrl).then(response=>{
				resp=response;
				return response.arrayBuffer();
			}).then(blob=>{
				new Response(blob).arrayBuffer().then(buffer=>{
					let uint=[...new Uint8Array(buffer)];
					uint.modTime=resp.headers.get('Last-Modified');
					uint.fileUrl=`${this.name}/${folder}${fileUrl}`;							
					this.zip[fileUrl]=uint;
				});
			});				
		});
	}
    
    str2zip(name,str,folder){
        let uint=[...new Uint8Array(this.str2dec(str))];
        uint.name=name;
        uint.modTime=new Date();
        uint.fileUrl=`${this.name}/${folder}${name}`;
        this.zip[uint.fileUrl]=uint;
    }
    
    files2zip(files,folder){
        for(let i=0;i<files.length;i++){
            files[i].arrayBuffer().then(data=>{
                let uint=[...new Uint8Array(data)];
                uint.name=files[i].name;
                uint.modTime=files[i].lastModifiedDate;
                uint.fileUrl=`${this.name}/${folder}${files[i].name}`;
                this.zip[uint.fileUrl]=uint;                            
            });
        }
    }
    
    async makeZip(){
        const encoder = new TextEncoder();
        const localParts = [];
        const centralParts = [];
        const utf8Flag = 0x0800;
        let localOffset = 0;
        let entryCount = 0;

        const getDosDateTime = value => {
            const inputDate = value ? new Date(value) : new Date();
            const date = Number.isNaN(inputDate.getTime()) ? new Date() : inputDate;
            const year = Math.max(1980, Math.min(2107, date.getFullYear()));
            const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
            const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
            return { time, date: dosDate };
        };

        for (const key in this.zip) {
            const entry = this.zip[key];
            if (entry.fileUrl === undefined) continue;

            const fileName = encoder.encode(entry.fileUrl);
            const data = new Uint8Array(entry);
            const crc = this.crc32(data);
            const { time, date } = getDosDateTime(entry.modTime);
            const localHeader = new Uint8Array(30);
            const localView = new DataView(localHeader.buffer);

            localView.setUint32(0, 0x04034b50, true);
            localView.setUint16(4, 20, true);
            localView.setUint16(6, utf8Flag, true);
            localView.setUint16(8, 0, true);
            localView.setUint16(10, time, true);
            localView.setUint16(12, date, true);
            localView.setUint32(14, crc, true);
            localView.setUint32(18, data.length, true);
            localView.setUint32(22, data.length, true);
            localView.setUint16(26, fileName.length, true);
            localView.setUint16(28, 0, true);

            const centralHeader = new Uint8Array(46);
            const centralView = new DataView(centralHeader.buffer);
            centralView.setUint32(0, 0x02014b50, true);
            centralView.setUint16(4, 20, true);
            centralView.setUint16(6, 20, true);
            centralView.setUint16(8, utf8Flag, true);
            centralView.setUint16(10, 0, true);
            centralView.setUint16(12, time, true);
            centralView.setUint16(14, date, true);
            centralView.setUint32(16, crc, true);
            centralView.setUint32(20, data.length, true);
            centralView.setUint32(24, data.length, true);
            centralView.setUint16(28, fileName.length, true);
            centralView.setUint16(30, 0, true);
            centralView.setUint16(32, 0, true);
            centralView.setUint16(34, 0, true);
            centralView.setUint16(36, 0, true);
            centralView.setUint32(38, 0, true);
            centralView.setUint32(42, localOffset, true);

            localParts.push(localHeader, fileName, data);
            centralParts.push(centralHeader, fileName);
            localOffset += localHeader.length + fileName.length + data.length;
            entryCount++;
        }

        const centralDirectorySize = centralParts.reduce((size, part) => size + part.length, 0);
        const endRecord = new Uint8Array(22);
        const endView = new DataView(endRecord.buffer);
        endView.setUint32(0, 0x06054b50, true);
        endView.setUint16(4, 0, true);
        endView.setUint16(6, 0, true);
        endView.setUint16(8, entryCount, true);
        endView.setUint16(10, entryCount, true);
        endView.setUint32(12, centralDirectorySize, true);
        endView.setUint32(16, localOffset, true);
        endView.setUint16(20, 0, true);

        const archive = new Blob([...localParts, ...centralParts, endRecord], { type: 'application/zip' });
        if (window.splatoonDesktop?.saveFile) {
            try {
                const savedPath = await window.splatoonDesktop.saveFile(
                    `${this.name}.zip`,
                    Array.from(new Uint8Array(await archive.arrayBuffer())),
                );
                if (savedPath) alert(`已保存到 ${savedPath}`);
            } catch (error) {
                alert(`Unable to save archive: ${error}`);
                throw error;
            }
            return;
        }
        const objectUrl = URL.createObjectURL(archive);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = `${this.name}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
}
