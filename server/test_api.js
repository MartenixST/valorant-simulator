async function testApi() {
    const id = '1764751711889.0';
    try {
        console.log(`Testing API with ID: ${id}`);
        const response = await fetch(`http://localhost:5000/api/saves/${id}`);
        if (response.ok) {
            const data = await response.json();
            console.log('Success!', data.id);
        } else {
            console.log('Failed!', response.status);
        }
    } catch (error) {
        console.error('Error!', error.message);
    }
}

testApi();
