import axios from "axios";

async function requests (api, data, method = 'POST') {
    api = `http://127.0.0.1:16001/${api}`
    switch (method) {
        case "POST":
            return await axios.post(api, data, {
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(res => res.data)
                .catch(err => err.response.data);
        case "GET":
            return await axios.get(api, {
                params: data,
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(res => res.data)
                .catch(err => err.response.data);
        default:
            return await axios.post(api, data, {
                headers: {
                    'Content-Type': 'application/json'
                }
            })
                .then(res => res.data)
                .catch(err => err.response.data);
    }
}

export default requests;