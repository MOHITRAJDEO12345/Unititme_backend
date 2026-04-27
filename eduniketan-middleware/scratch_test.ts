import axios from 'axios';

async function test() {
    try {
        console.log('Testing connection to http://localhost:4001/api/solver/stats');
        const resp = await axios.get('http://localhost:4001/api/solver/stats');
        console.log('Success:', resp.data);
    } catch (err: any) {
        console.error('Error:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
}

test();
